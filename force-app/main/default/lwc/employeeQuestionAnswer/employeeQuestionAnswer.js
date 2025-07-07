import { LightningElement, track, wire } from 'lwc';
import getCurrentUser from '@salesforce/apex/UserController.getCurrentUser';
import getFeedbackData from '@salesforce/apex/QuestionsController.getFeedbackData';
import submitFeedback from '@salesforce/apex/QuestionsController.submitFeedback';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import sendEmailOnFeedbackSubmit from '@salesforce/apex/EmailController.sendEmailOnFeedbackSubmit';

export default class EmployeeQuestionAnswer extends LightningElement {
    @track userData;
    @track feedbackData = {};
    @track error;
    @track isLoading = true;
    @track isSubmitting = false;
    @track viewSubmissionButtonClicked = false;
    @track viewManagerFeedbackClicked = false;
    

    // lets run send email when we load this page to test what is getting debugged.
   
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
            console.log('feedbackResponse', feedbackResponse);
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
                    isRating: q.inputType === 'Rating',
                    isEmoji: q.inputType === 'Emoji',
                    isPicklist: q.inputType === 'Picklist',
                    isSlider: q.inputType === 'Slider',
                    picklistOptions: q.inputType === 'Picklist' 
                        ? (q.isMetadataPicklist ? q.picklistOptions : this.getPicklistOptions(q.picklistValues))
                        : [],
                    scaleOptions: q.scaleOptions || [],
                    starOptions: q.inputType === 'Rating' ? this.createRatingOptions(q.scaleOptions) : [],
                    sliderMin: q.sliderMin || 1,
                    sliderMax: q.sliderMax || 10
                }))
            }
            console.log('Processed feedback data:', JSON.stringify(this.feedbackData));
        }else{
            this.feedbackData = {
                ...data
            }
        }
    }

   async handleSendEmailOnFeedbackSubmit(){
        console.log('🚀 Starting email sending process...');
        console.log('⏰ Timestamp:', new Date().toISOString());
        
        try {
            const result = await sendEmailOnFeedbackSubmit();
            
            console.log('✅ Email sending method completed!');
            console.log('📧 DETAILED EMAIL RESULT:');
            console.log('═══════════════════════════════════════');
            console.log(result);
            console.log('═══════════════════════════════════════');
            
            // Parse the result to show specific components
            if (result.includes('SUCCESS:')) {
                console.log('🎉 EMAIL STATUS: SUCCESS');
            } else if (result.includes('PARTIAL SUCCESS:')) {
                console.log('⚠️ EMAIL STATUS: PARTIAL SUCCESS');
            } else if (result.includes('ERROR:')) {
                console.log('❌ EMAIL STATUS: ERROR');
            }
            
            // Check for specific issues
            if (result.includes('FAILED:')) {
                console.log('💥 SOME EMAILS FAILED TO SEND');
            }
            if (result.includes('EXCEPTION:')) {
                console.log('🚨 EXCEPTIONS OCCURRED DURING SENDING');
            }
            if (result.includes('Org Type:')) {
                const orgMatch = result.match(/Org Type: ([^(]+)/);
                if (orgMatch) {
                    console.log('🏢 Organization Type:', orgMatch[1].trim());
                    if (orgMatch[1].includes('Developer Edition')) {
                        console.log('⚠️ WARNING: Developer Edition has strict email limits (5-15 emails/day)!');
                    }
                }
            }
            
            return result;
        } catch (error) {
            console.log('❌ Email sending failed with error:');
            console.log('═══════════════════════════════════════');
            console.error('Error Object:', error);
            console.error('Error Message:', error.message || 'No message available');
            console.error('Error Body:', error.body || 'No body available');
            console.error('Full Error JSON:', JSON.stringify(error));
            console.log('═══════════════════════════════════════');
            throw error;
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

    createRatingOptions(scaleOptions) {
        // If no scale options provided, default to stars
        let iconLabel = '⭐';
        
        // Get the icon from the first scale option if available
        if (scaleOptions && scaleOptions.length > 0) {
            iconLabel = scaleOptions[0].label || scaleOptions[0].value || '⭐';
        }
        
        // Always create exactly 5 rating options regardless of metadata configuration
        return Array.from({length: 5}, (_, index) => ({
            value: (index + 1).toString(),
            label: iconLabel,
            order: index + 1
        }));
    }

    formatRatingForDisplay(ratingAnswer, scaleOptions) {
        // Check if it's a metadata reference format: rating//scaleGroup//value
        if (ratingAnswer && ratingAnswer.startsWith('rating//')) {
            const parts = ratingAnswer.split('//');
            if (parts.length === 3) {
                const ratingValue = parseInt(parts[2]);
                if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
                    // Get the icon from scale options
                    let iconLabel = '⭐'; // Default fallback
                    if (scaleOptions && scaleOptions.length > 0) {
                        iconLabel = scaleOptions[0].label || scaleOptions[0].value || '⭐';
                    }
                    
                    // Repeat the icon ratingValue times
                    return iconLabel.repeat(ratingValue);
                }
            }
        }
        
        // Backwards compatibility: if it's just a number
        const ratingValue = parseInt(ratingAnswer);
        if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
            return '⭐'.repeat(ratingValue);
        }
        
        // If we can't parse it, return as-is
        return ratingAnswer;
    }

    handleStarClick(event) {
        const questionId = event.target.dataset.id;
        const value = event.target.dataset.value;
        
        // Remove selected class from all rating buttons for this question
        const starContainer = event.target.closest('.star-rating');
        const allButtons = starContainer.querySelectorAll('.star-button');
        allButtons.forEach(button => button.classList.remove('selected'));
        
        // Add selected class to clicked button and all previous buttons (cumulative selection)
        const clickedValue = parseInt(value);
        allButtons.forEach((button, index) => {
            if (index < clickedValue) {
                button.classList.add('selected');
            }
        });
        
        // Find the question to get the scale group
        const question = this.feedbackData.questions.find(q => q.id === questionId);
        const scaleGroup = question ? question.scaleGroup : '';
        
        // Store metadata reference similar to emoji handling
        // Format: rating//scaleGroup//value
        const metadataReference = `rating//${scaleGroup}//${value}`;
        starContainer.dataset.selectedValue = metadataReference;
    }

    handleEmojiClick(event) {
        const questionId = event.target.dataset.id;
        const value = event.target.dataset.value;
        const emojiLabel = event.target.dataset.label;
        
        // Remove selected class from all emojis for this question
        const emojiContainer = event.target.closest('.emoji-rating');
        const allEmojis = emojiContainer.querySelectorAll('.emoji-button');
        allEmojis.forEach(emoji => emoji.classList.remove('selected'));
        
        // Add selected class to clicked emoji
        event.target.classList.add('selected');
        
        // Find the question to get the scale group
        const question = this.feedbackData.questions.find(q => q.id === questionId);
        const scaleGroup = question ? question.scaleGroup : '';
        
        // Store metadata reference instead of emoji value
        // Format: emoji//scaleGroup//label
        const metadataReference = `emoji//${scaleGroup}//${emojiLabel}`;
        emojiContainer.dataset.selectedValue = metadataReference;
        
        // Also store the display emoji for immediate UI feedback
        emojiContainer.dataset.displayValue = value;
    }

    handleSliderChange(event) {
        const questionId = event.target.dataset.id;
        const value = event.target.value;
        
        // Store the slider value
        event.target.dataset.selectedValue = value;
    }

    handleSubmit() {
        this.isSubmitting = true;
        
        // Get all answers
        const inputs = this.template.querySelectorAll('lightning-input[data-id]');
        const comboboxes = this.template.querySelectorAll('lightning-combobox[data-id]');
        const starRatings = this.template.querySelectorAll('.star-rating[data-id]');
        const emojiRatings = this.template.querySelectorAll('.emoji-rating[data-id]');
        const sliders = this.template.querySelectorAll('lightning-slider[data-id]');
        
        const answers = [];
        let isValid = true;
        
        // Process text inputs
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
        
        // Process star ratings
        starRatings.forEach(starRating => {
            const questionId = starRating.dataset.id;
            const value = starRating.dataset.selectedValue;
            
            if (!value) {
                isValid = false;
                return;
            }
            
            answers.push({
                "questionId": questionId,
                "answer": value
            });
        });
        
        // Process emoji ratings
        emojiRatings.forEach(emojiRating => {
            const questionId = emojiRating.dataset.id;
            const value = emojiRating.dataset.selectedValue;
            
            if (!value) {
                isValid = false;
                return;
            }
            
            answers.push({
                "questionId": questionId,
                "answer": value
            });
        });
        
        // Process sliders
        sliders.forEach(slider => {
            const questionId = slider.dataset.id;
            const value = slider.value;
            
            if (!value) {
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
        .then(async () => {
            console.log('💾 Feedback submitted successfully to database');
            
            // Handle email sending with proper error handling
            try {
                const emailResult = await this.handleSendEmailOnFeedbackSubmit();
                console.log('📬 Email notification process completed');
                console.log('📋 Final Email Status:', emailResult);
                
                // Show success message including email status
                this.showToast('Success', 'Feedback submitted and email notifications sent successfully', 'success');
            } catch (emailError) {
                console.error('📧 Email sending failed but feedback was saved:', emailError);
                // Show partial success message
                this.showToast('Partial Success', 'Feedback submitted successfully, but email notification failed', 'warning');
            }
            
            // CHANGE: Immediately update the UI without waiting for server refresh
            this.updateSubmittedFeedback(answers);
            
            // CHANGE: Don't call loadData() as it can override our UI state
            // this.loadData();
        })
        .catch(error => {
            console.error('💥 Feedback submission failed:', JSON.stringify(error));
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
            const updatedQuestions = this.feedbackData.questions.map(q => {
                let displayAnswer = answerMap[q.id] || q.answer;
                
                // For emoji questions, if we stored a metadata reference, 
                // format for employee view (emoji + label)
                if (q.isEmoji && answerMap[q.id] && answerMap[q.id].startsWith('emoji//')) {
                    const emojiContainer = this.template.querySelector(`.emoji-rating[data-id="${q.id}"]`);
                    if (emojiContainer && emojiContainer.dataset.displayValue) {
                        // Get the label from the question's scale options
                        const selectedOption = q.scaleOptions.find(opt => opt.value === emojiContainer.dataset.displayValue);
                        if (selectedOption) {
                            displayAnswer = selectedOption.value + ' (' + selectedOption.label + ')';
                        } else {
                            displayAnswer = emojiContainer.dataset.displayValue;
                        }
                    }
                }
                
                // For rating questions, format for employee view (proper icons)
                if (q.isRating && answerMap[q.id]) {
                    displayAnswer = this.formatRatingForDisplay(answerMap[q.id], q.scaleOptions);
                }
                
                return {
                    ...q,
                    answer: displayAnswer,
                    hasResponse: true
                };
            });
            
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