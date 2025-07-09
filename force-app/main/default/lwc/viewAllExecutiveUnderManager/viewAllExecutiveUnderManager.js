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
    
    // New getter to create display objects for each user
    get displayUsers() {
        return this.users.map(user => {
            const responseData = this.userResponses[user.Id];
            const isExpanded = user.expanded;
            const showFeedback = this.showFeedbackInput[user.Id] || false;
            const isSubmittingFeedback = this.isSubmitting[user.Id] || false;
            const feedbackText = this.managerFeedbackText[user.Id] || '';
            const formExists = this.formExists[user.Id] || false; // Add this line
    
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
                formExists: formExists // Add this line
            };
        });
    }

    handleViewClick(event) {
        const userId = event.target.dataset.id;
        
        // Toggle the expanded state for this user
        this.users = this.users.map(user => {
            if (user.Id === userId) {
                const newExpandedState = !user.expanded;
                user.isView = user.isView === 'View' ? 'Hide' : 'View';

                // If expanding and we don't have the responses yet, fetch them
                if (newExpandedState && !this.userResponses[userId]) {
                    this.fetchEmployeeResponses(userId);
                }
                
                return {...user, expanded: newExpandedState, isView: user.isView};
            }
            return user;
        });
    }
    
    fetchEmployeeResponses(userId) {
        console.log('fetchEmployeeResponses', userId);
        // Set loading state
        this.isLoading = true;
        
        getEmployeeResponseForManager({ employeeId: userId })
            .then(result => {
                console.log(result)
                // Store the response data for this user
                this.userResponses = {
                    ...this.userResponses,
                    [userId]: result
                };
                

                // Initialize feedback text for this user if needed
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
        
        // Show the feedback input for this user
        this.showFeedbackInput = {
            ...this.showFeedbackInput,
            [userId]: true
        };
    }
    
    handleFeedbackChange(event) {
        const userId = event.target.dataset.id;
        
        // Update the feedback text for this user
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
        
        // Set submitting state
        this.isSubmitting = {
            ...this.isSubmitting,
            [userId]: true
        };
        
        // Create the response object
        const response = {
            managerResponseText: feedbackText,
            employeeId: userId
        };
        
        submitManagerResponse({ response })
            .then(result => {
                this.showToast('Success', 'Feedback submitted successfully', 'success');
                
                // Update the local data to reflect submission
                if (this.userResponses[userId]) {
                    this.userResponses = {
                        ...this.userResponses,
                        [userId]: {
                            ...this.userResponses[userId],
                            hasManagerSubmitted: true,
                            managerResponseText: feedbackText // Add this line to update the displayed text
                        }
                    };
                }
                
                // Hide the feedback input
                this.showFeedbackInput = {
                    ...this.showFeedbackInput,
                    [userId]: false
                };
                
                // Clear the submitting state
                this.isSubmitting = {
                    ...this.isSubmitting,
                    [userId]: false
                };
            })
            .catch(error => {
                console.error('Error submitting feedback:', error);
                this.showToast('Error', 'Failed to submit feedback: ' + this.extractErrorMessage(error), 'error');
                
                // Clear the submitting state
                this.isSubmitting = {
                    ...this.isSubmitting,
                    [userId]: false
                };
            });
    }
    
    handleCancelFeedback(event) {
        const userId = event.target.dataset.id;
        
        // Hide the feedback input for this user
        this.showFeedbackInput = {
            ...this.showFeedbackInput,
            [userId]: false
        };
        
        // Reset the feedback text
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