import { LightningElement, track, wire } from 'lwc';
import getCurrentUser from '@salesforce/apex/UserController.getCurrentUser';
import getFeedbackData from '@salesforce/apex/QuestionsController.getFeedbackData';
import submitFeedback from '@salesforce/apex/QuestionsController.submitFeedback';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class EmployeeQuestionAnswer extends LightningElement {
    @track userData;
    @track feedbackData = {};
    @track error;
    @track isLoading = true;
    @track isSubmitting = false;
    @track viewSubmissionButtonClicked = false;
    @track viewManagerFeedbackClicked = false;
    
    // New property to track if any responses are being viewed
    get isViewingResponses() {
        return this.viewSubmissionButtonClicked || this.viewManagerFeedbackClicked;
    }

    connectedCallback() {
        this.loadData();
    }

    async loadData() {
        this.isLoading = true;
        try {
            // Get current user data
            const user = await getCurrentUser();
            this.userData = user;
            
            // Get all feedback data in one call
            const feedbackResponse = await getFeedbackData();
            this.processFeedbackData(feedbackResponse);
        } catch (err) {
            console.error('Error loading data', err);
            this.error = err?.body?.message || err?.message;
            this.showToast('Error loading data', this.error, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    processFeedbackData(data) {
        console.log('Data:', JSON.stringify(data));
        if (data && data.questions) {
            this.feedbackData = {
                ...data,
                questions: data.questions.map(q => ({
                    ...q,
                    isText: q.inputType === 'Text',
                    isNumber: q.inputType === 'Rating',
                    isPicklist: q.inputType === 'Picklist',
                    picklistOptions: q.inputType === 'Picklist' 
                        ? this.getPicklistOptions(q.picklistValues) 
                        : []
                }))
            };
            console.log('Processed feedback data:', JSON.stringify(this.feedbackData));
        }
    }

    getPicklistOptions(valueString) {
        if (!valueString) return [];
        
        // Handle both comma and semicolon separators
        const separator = valueString.includes(';') ? ';' : ',';
        
        return valueString.split(separator).map(value => ({
            label: value.trim(),
            value: value.trim()
        }));
    }

    handleSubmit() {
        this.isSubmitting = true;
        
        // Get all answers
        const inputs = this.template.querySelectorAll('lightning-input[data-id]');
        const comboboxes = this.template.querySelectorAll('lightning-combobox[data-id]');
        
        const answers = [];
        let isValid = true;
        
        // Process inputs
        inputs.forEach(input => {
            const questionId = input.dataset.id;
            const value = input.value;
            
            if (!value) {
                input.reportValidity();
                isValid = false;
                return;
            }
            
            answers.push({
                "questionId": questionId,
                "answer": value
            });
        });
        
        // Process comboboxes
        comboboxes.forEach(combobox => {
            const questionId = combobox.dataset.id;
            const value = combobox.value;
            
            if (!value) {
                combobox.reportValidity();
                isValid = false;
                return;
            }
            
            answers.push({
                "questionId": questionId,
                "answer": value
            });
        });
        
        if (!isValid) {
            this.isSubmitting = false;
            this.showToast('Missing Answers', 'Please answer all questions before submitting', 'error');
            return;
        }
        
        // Submit feedback
        submitFeedback({
            answers: answers,
            respondentId: this.userData.Id
        })
        .then(() => {
            this.showToast('Success', 'Feedback submitted successfully', 'success');
            
            // CHANGE: Immediately update the UI without waiting for server refresh
            this.updateSubmittedFeedback(answers);
            
            // CHANGE: Don't call loadData() as it can override our UI state
            // this.loadData();
        })
        .catch(error => {
            console.error('Error:', JSON.stringify(error));
            this.showToast('Error', error.body?.message || 'Submission failed', 'error');
        })
        .finally(() => {
            this.isSubmitting = false;
        });
    }
    
    // Update method to properly set hasSubmitted flag
    updateSubmittedFeedback(answers) {
        // Create a map of questionId to answer for quick lookup
        const answerMap = {};
        answers.forEach(a => {
            answerMap[a.questionId] = a.answer;
        });
        
        // Update the existing feedbackData with submitted answers
        if (this.feedbackData && this.feedbackData.questions) {
            const updatedQuestions = this.feedbackData.questions.map(q => ({
                ...q,
                answer: answerMap[q.id] || q.answer,
                hasResponse: true
            }));
            
            // CHANGE: Create a new object to trigger reactivity properly
            this.feedbackData = {
                ...this.feedbackData,
                questions: updatedQuestions,
                hasSubmitted: true
            };
            
            // CHANGE: Add logging to verify state change
            console.log('Updated feedback data after submission:', 
                JSON.stringify({
                    hasSubmitted: this.feedbackData.hasSubmitted,
                    questionCount: this.feedbackData.questions.length
                })
            );
        }
    }

    handleViewSubmissionClick() {
        console.log('View Submission clicked');
        
        // Toggle view submission state
        this.viewSubmissionButtonClicked = !this.viewSubmissionButtonClicked;
        
        // If we're showing submission, hide manager feedback
        if(this.viewSubmissionButtonClicked) {
            this.viewManagerFeedbackClicked = false;
        }
        
        console.log('viewSubmissionButtonClicked:', this.viewSubmissionButtonClicked);
        console.log('isViewingResponses:', this.isViewingResponses);
    }

    handleViewManagerClick() {
        console.log('View Manager clicked');
        
        // Toggle manager feedback state
        this.viewManagerFeedbackClicked = !this.viewManagerFeedbackClicked;
        
        // If we're showing manager feedback, hide submission
        if(this.viewManagerFeedbackClicked) {
            this.viewSubmissionButtonClicked = false;
        }
        
        console.log('viewManagerFeedbackClicked:', this.viewManagerFeedbackClicked);
        console.log('isViewingResponses:', this.isViewingResponses);
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}