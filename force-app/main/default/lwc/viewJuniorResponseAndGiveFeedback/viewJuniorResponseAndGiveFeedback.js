import { LightningElement, wire, track } from 'lwc';
import getUsersUnderCurrentUser from '@salesforce/apex/UserController.getUsersUnderCurrentUser';
import getEmployeeResponseForManager from '@salesforce/apex/QuestionsController.getEmployeeResponseForManager';
import submitManagerResponse from '@salesforce/apex/QuestionsController.submitManagerResponse';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ViewAllExecutiveUnderManager extends LightningElement {
    @track users = [];
    @track userResponses = {};
    @track showFeedbackInput = {};
    @track managerFeedbackText = {};
    @track isSubmitting = {};
    @track formExists= {};

    error;
    isLoading = true;
    
    @wire(getUsersUnderCurrentUser)
    wiredUsersUnderCurrentUser({ error, data }) {
        console.log('data: ' + data);
        this.isLoading = false;
        if (data) {
            this.users = data.map(user => ({
                ...user,
                RoleName: user.UserRole ? user.UserRole.Name : '',
                expanded: false,
                isView: 'View'
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error.body ? error.body.message : 'Unknown error';
            this.users = [];
        }
    }

    get hasUsers() {
        return this.users && this.users.length > 0;
    }
    
    get displayUsers() {
        return this.users.map(user => {
            const responseData = this.userResponses[user.Id];
            const isExpanded = user.expanded;
            const showFeedback = this.showFeedbackInput[user.Id] || false;
            const isSubmittingFeedback = this.isSubmitting[user.Id] || false;
            const feedbackText = this.managerFeedbackText[user.Id] || '';
            const formExists = this.formExists[user.Id] || false;
    
            return {
                user: user,
                expandedClass: isExpanded ? 'expanded-view' : 'collapsed-view',
                isView: user.isView,
                hasResponseData: !!responseData,
                hasEmployeeSubmitted: responseData ? responseData.hasEmployeeSubmitted : false,
                hasManagerSubmitted: responseData ? responseData.hasManagerSubmitted : false,
                managerResponseText: responseData ? responseData.managerResponseText : '',
                questions: responseData ? responseData.questions : [],
                showFeedbackForm: showFeedback,
                isSubmitting: isSubmittingFeedback,
                feedbackText: feedbackText,
                formExists: formExists
            };
        });
    }

    handleViewClick(event) {
        const userId = event.target.dataset.id;
        
        this.users = this.users.map(user => {
            if (user.Id === userId) {
                const newExpandedState = !user.expanded;
                user.isView = user.isView === 'View' ? 'Hide' : 'View';

                if (newExpandedState && !this.userResponses[userId]) {
                    this.fetchEmployeeResponses(userId);
                }
                
                return {...user, expanded: newExpandedState, isView: user.isView};
            }
            return user;
        });
    }
    
    fetchEmployeeResponses(userId) {
        this.isLoading = true;
        
        getEmployeeResponseForManager({ employeeId: userId })
            .then(result => {
                this.userResponses = {
                    ...this.userResponses,
                    [userId]: result
                };
                
                if (!this.managerFeedbackText[userId]) {
                    this.managerFeedbackText = {
                        ...this.managerFeedbackText,
                        [userId]: ''
                    };
                }

                this.formExists = {
                    ...this.formExists,
                    [userId]: result.formExists
                };
                
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error fetching employee responses:', error);
                this.showToast('Error', 'Failed to load employee responses: ' + this.extractErrorMessage(error), 'error');
                this.isLoading = false;
            });
    }
    
    handleShowFeedbackInput(event) {
        const userId = event.target.dataset.id;
        
        this.showFeedbackInput = {
            ...this.showFeedbackInput,
            [userId]: true
        };
    }
    
    handleFeedbackChange(event) {
        const userId = event.target.dataset.id;
        
        this.managerFeedbackText = {
            ...this.managerFeedbackText,
            [userId]: event.target.value
        };
    }
    
    handleSubmitFeedback(event) {
        const userId = event.target.dataset.id;
        const feedbackText = this.managerFeedbackText[userId];
        
        if (!feedbackText || feedbackText.trim() === '') {
            this.showToast('Error', 'Please enter feedback before submitting', 'error');
            return;
        }else{
            if(feedbackText.length > 500){
                this.showToast('Error', 'Feedback must be less than 500 characters', 'error');
                return;
            }
        }
        
        this.isSubmitting = {
            ...this.isSubmitting,
            [userId]: true
        };
        
        const response = {
            managerResponseText: feedbackText,
            employeeId: userId
        };
        
        submitManagerResponse({ response })
            .then(result => {
                this.showToast('Success', 'Feedback submitted successfully', 'success');
                
                if (this.userResponses[userId]) {
                    this.userResponses = {
                        ...this.userResponses,
                        [userId]: {
                            ...this.userResponses[userId],
                            hasManagerSubmitted: true,
                            managerResponseText: feedbackText
                        }
                    };
                }
                
                this.showFeedbackInput = {
                    ...this.showFeedbackInput,
                    [userId]: false
                };
                
                this.isSubmitting = {
                    ...this.isSubmitting,
                    [userId]: false
                };
            })
            .catch(error => {
                console.error('Error submitting feedback:', error);
                this.showToast('Error', 'Failed to submit feedback: ' + this.extractErrorMessage(error), 'error');
                
                this.isSubmitting = {
                    ...this.isSubmitting,
                    [userId]: false
                };
            });
    }
    
    handleCancelFeedback(event) {
        const userId = event.target.dataset.id;
        
        this.showFeedbackInput = {
            ...this.showFeedbackInput,
            [userId]: false
        };
        
        this.managerFeedbackText = {
            ...this.managerFeedbackText,
            [userId]: ''
        };
    }
    
    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(evt);
    }
    
    extractErrorMessage(error) {
        return error.body?.message || error.message || 'Unknown error';
    }
}