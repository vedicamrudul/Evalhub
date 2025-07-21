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
    
    get isViewingResponses() {
        return this.viewSubmissionButtonClicked || this.viewManagerFeedbackClicked;
    }

    get submissionButtonClass() {
        return this.viewSubmissionButtonClicked ? 'active-button' : '';
    }

    get managerButtonClass() {
        return this.viewManagerFeedbackClicked ? 'active-button' : '';
    }

    connectedCallback() {
        this.loadData();
    }

    async loadData() {
        this.isLoading = true;
        try {
            const user = await getCurrentUser();
            this.userData = user;
            
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
        }else{
            this.feedbackData = {
                ...data
            }
        }
    }

   async handleSendEmailOnFeedbackSubmit(){
        try {
            const result = await sendEmailOnFeedbackSubmit();
            return result;
        } catch (error) {
            console.error('❌ Email sending failed:', error.message || error);
            throw error;
        }
    }

    getPicklistOptions(valueString) {
        if (!valueString) return [];
        
        const separator = valueString.includes(';') ? ';' : ',';
        
        return valueString.split(separator).map(value => ({
            label: value.trim(),
            value: value.trim()
        }));
    }

    createRatingOptions(scaleOptions) {
        let iconLabel = '⭐';
        
        if (scaleOptions && scaleOptions.length > 0) {
            iconLabel = scaleOptions[0].label || scaleOptions[0].value || '⭐';
        }
        
        return Array.from({length: 5}, (_, index) => ({
            value: (index + 1).toString(),
            label: iconLabel,
            order: index + 1
        }));
    }

    formatRatingForDisplay(ratingAnswer, scaleOptions) {
        if (ratingAnswer && ratingAnswer.startsWith('rating//')) {
            const parts = ratingAnswer.split('//');
            if (parts.length === 3) {
                const ratingValue = parseInt(parts[2]);
                if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
                    let iconLabel = '⭐';
                    if (scaleOptions && scaleOptions.length > 0) {
                        iconLabel = scaleOptions[0].label || scaleOptions[0].value || '⭐';
                    }
                    
                    return iconLabel.repeat(ratingValue);
                }
            }
        }
        
        const ratingValue = parseInt(ratingAnswer);
        if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
            return '⭐'.repeat(ratingValue);
        }
        
        return ratingAnswer;
    }

    handleStarClick(event) {
        const questionId = event.target.dataset.id;
        const value = event.target.dataset.value;
        
        const starContainer = event.target.closest('.star-rating');
        const allButtons = starContainer.querySelectorAll('.star-button');
        allButtons.forEach(button => button.classList.remove('selected'));
        
        const clickedValue = parseInt(value);
        allButtons.forEach((button, index) => {
            if (index < clickedValue) {
                button.classList.add('selected');
            }
        });
        
        const question = this.feedbackData.questions.find(q => q.id === questionId);
        const scaleGroup = question ? question.scaleGroup : '';
        
        const metadataReference = `rating//${scaleGroup}//${value}`;
        starContainer.dataset.selectedValue = metadataReference;
    }

    handleEmojiClick(event) {
        const questionId = event.target.dataset.id;
        const value = event.target.dataset.value;
        const emojiLabel = event.target.dataset.label;
        
        const emojiContainer = event.target.closest('.emoji-rating');
        const allEmojis = emojiContainer.querySelectorAll('.emoji-button');
        allEmojis.forEach(emoji => emoji.classList.remove('selected'));
        
        event.target.classList.add('selected');
        
        const question = this.feedbackData.questions.find(q => q.id === questionId);
        const scaleGroup = question ? question.scaleGroup : '';
        
        const metadataReference = `emoji//${scaleGroup}//${emojiLabel}`;
        emojiContainer.dataset.selectedValue = metadataReference;
        
        emojiContainer.dataset.displayValue = value;
    }

    handleSliderChange(event) {
        const questionId = event.target.dataset.id;
        const value = event.target.value;
        
        event.target.dataset.selectedValue = value;
    }

    handleSubmit() {
        this.isSubmitting = true;
        
        const textareas = this.template.querySelectorAll('lightning-textarea[data-id]');
        const comboboxes = this.template.querySelectorAll('lightning-combobox[data-id]');
        const starRatings = this.template.querySelectorAll('.star-rating[data-id]');
        const emojiRatings = this.template.querySelectorAll('.emoji-rating[data-id]');
        const sliders = this.template.querySelectorAll('lightning-slider[data-id]');
        
        const answers = [];
        let isValid = true;
        
        textareas.forEach(textarea => {
            const questionId = textarea.dataset.id;
            const value = textarea.value;
            
            if(value && value.length > 500){
                this.showToast('Error', 'Answer must be less than 500 characters', 'error');
                textarea.reportValidity();
                isValid = false;
                return;
            }
            
            if (!value) {
                textarea.reportValidity();
                isValid = false;
                return;
            }
            
            answers.push({
                "questionId": questionId,
                "answer": value
            });
        });
        
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
        
        submitFeedback({
            answers: answers,
            respondentId: this.userData.Id
        })
        .then(async () => {
            try {
                const emailResult = await this.handleSendEmailOnFeedbackSubmit();
                this.showToast('Success', 'Feedback submitted and emails sent successfully', 'success');
            } catch (emailError) {
                console.error('Email failed:', emailError);
                this.showToast('Partial Success', 'Feedback submitted, but email notification failed', 'warning');
            }
            
            this.updateSubmittedFeedback(answers);
        })
        .catch(error => {
            console.error('❌ Feedback submission failed:', error);
            this.showToast('Error', error.body?.message || 'Submission failed', 'error');
        })
        .finally(() => {
            this.isSubmitting = false;
        });
    }
    
    updateSubmittedFeedback(answers) {
        const answerMap = {};
        answers.forEach(a => {
            answerMap[a.questionId] = a.answer;
        });
        
        if (this.feedbackData && this.feedbackData.questions) {
            const updatedQuestions = this.feedbackData.questions.map(q => {
                let displayAnswer = answerMap[q.id] || q.answer;
                
                if (q.isEmoji && answerMap[q.id] && answerMap[q.id].startsWith('emoji//')) {
                    const emojiContainer = this.template.querySelector(`.emoji-rating[data-id="${q.id}"]`);
                    if (emojiContainer && emojiContainer.dataset.displayValue) {
                        const selectedOption = q.scaleOptions.find(opt => opt.value === emojiContainer.dataset.displayValue);
                        if (selectedOption) {
                            displayAnswer = selectedOption.value + ' (' + selectedOption.label + ')';
                        } else {
                            displayAnswer = emojiContainer.dataset.displayValue;
                        }
                    }
                }
                
                if (q.isRating && answerMap[q.id]) {
                    displayAnswer = this.formatRatingForDisplay(answerMap[q.id], q.scaleOptions);
                }
                
                return {
                    ...q,
                    answer: displayAnswer,
                    hasResponse: true
                };
            });
            
            this.feedbackData = {
                ...this.feedbackData,
                questions: updatedQuestions,
                hasSubmitted: true
            };
        }
    }

    handleViewSubmissionClick() {
        this.viewSubmissionButtonClicked = !this.viewSubmissionButtonClicked;
        
        if(this.viewSubmissionButtonClicked) {
            this.viewManagerFeedbackClicked = false;
        }
    }

    handleViewManagerClick() {
        this.viewManagerFeedbackClicked = !this.viewManagerFeedbackClicked;
        
        if(this.viewManagerFeedbackClicked) {
            this.viewSubmissionButtonClicked = false;
        }
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