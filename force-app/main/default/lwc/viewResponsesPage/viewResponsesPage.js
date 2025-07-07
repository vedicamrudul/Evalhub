import { LightningElement, wire, track } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import getAllUserResponsesForAdmin from '@salesforce/apex/QuestionsController.getAllUserResponsesForAdmin';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ViewResponsesPage extends NavigationMixin(LightningElement) {
    @track isLoading = false;
    @track formData;
    @track error;
    @track searchTerm = '';
    @track viewOption = 'all'; // all, submitted, pending, reviewed
    
    // Options for the view filter
    viewOptions = [
        { label: 'All', value: 'all' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Pending', value: 'pending' },
        { label: 'Reviewed', value: 'reviewed' }
    ];

    // Wire the page reference to get URL parameters
    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        if (pageRef) {
            console.log('Page Reference received:', JSON.stringify(pageRef));
            console.log('State parameters:', JSON.stringify(pageRef.state));
            
            // Get form ID from URL parameters - we now know we're using c__formId
            this.formId = pageRef.state?.c__formId;
            
            console.log('FormId extracted:', this.formId);
            
            if (this.formId) {
                this.loadUserResponses();
            } else {
                this.error = 'No form selected. Please select a form from the previous page.';
                console.error('No form ID found in URL parameters');
            }
        }
    }
    
    // Load user responses from server
    loadUserResponses() {
        if (!this.formId) {
            this.error = 'No form selected. Please select a form from the previous page.';
            return;
        }
        
        console.log('Loading user responses for formId:', this.formId);
        this.isLoading = true;
        this.error = null;
        
        getAllUserResponsesForAdmin({ formId: this.formId })
            .then(result => {
                console.log('User responses received:', JSON.stringify(result));
                this.formData = result;
                this.processUserResponsesData();
                this.applyFilters();
                
                if (result?.userResponses?.length > 0) {
                    this.showToast('Success', `Loaded ${result.userResponses.length} user responses`, 'success');
                } else {
                    this.showToast('Info', 'No user responses found for this form', 'info');
                }
            })
            .catch(error => {
                this.error = this.reduceErrors(error);
                this.showToast('Error', this.error, 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
    // Process user responses data to add computed properties
    processUserResponsesData() {
        if (!this.formData?.userResponses) return;
        
        // Create a deep clone to ensure objects are extensible
        this.formData = JSON.parse(JSON.stringify(this.formData));
        
        // Create a map of questions for reference
        const questionMap = {};
        if (this.formData.questions) {
            this.formData.questions.forEach(question => {
                questionMap[question.id] = question;
            });
        }
        
        // Process each user's responses
        this.formData.userResponses.forEach(user => {
            // Create a response map for easy lookup
            const responseMap = {};
            if (user.questionResponses) {
                user.questionResponses.forEach(response => {
                    response.isAnswered = !!response.answer && response.answer.trim() !== '';
                    if (response.questionId) {
                        responseMap[response.questionId] = response;
                    }
                });
            }
            
            // Store the response map on the user object
            user._responseMap = responseMap;
            
            // Pre-format answers for all questions in order
            user.formattedAnswers = [];
            if (this.formData.questions) {
                this.formData.questions.forEach(question => {
                    const response = responseMap[question.id];
                    let formattedText = 'No answer provided';
                    
                    if (response?.isAnswered) {
                        formattedText = this.formatResponseByType(response.answer, question.type);
                    }
                    
                    user.formattedAnswers.push({
                        questionId: question.id,
                        text: formattedText,
                        isAnswered: response?.isAnswered || false
                    });
                });
            }
        });
    }
    
    // Format response based on input type (Admin view - labels only)
    formatResponseByType(answer, inputType) {
        if (!answer) return 'No answer provided';
        
        switch (inputType) {
            case 'Rating':
                // Parse metadata reference or direct number for admin view
                return this.formatRatingForAdmin(answer);
            case 'Slider':
                return `${answer}/10`;
            case 'Emoji':
                // Admin/Manager view shows label only (no emoji)
                // The answer should already be formatted as label from Apex
                return answer;
            case 'Text':
            case 'Picklist':
            default:
                return answer;
        }
    }

    formatRatingForAdmin(answer) {
        // Check if it's a metadata reference format: rating//scaleGroup//value
        if (answer && answer.startsWith('rating//')) {
            const parts = answer.split('//');
            if (parts.length === 3) {
                const ratingValue = parseInt(parts[2]);
                if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
                    return `${ratingValue}/5`;
                }
            }
        }
        
        // Backwards compatibility: if it's just a number
        const ratingValue = parseInt(answer);
        if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
            return `${ratingValue}/5`;
        }
        
        // If it's already formatted (like "4 out of 5"), return as-is
        if (answer.includes('out of')) {
            return answer.replace('out of', '/');
        }
        
        // If we can't parse it, return as-is
        return answer;
    }

    // Apply filters based on search term and selected view
    applyFilters() {
        if (!this.formData?.userResponses) {
            this.filteredUserResponses = [];
            return;
        }
        
        const searchLower = this.searchTerm?.toLowerCase() || '';
        
        this.filteredUserResponses = this.formData.userResponses.filter(user => {
            // Apply search filter
            if (searchLower) {
                const matchesSearch = 
                    user.userName?.toLowerCase().includes(searchLower) ||
                    user.department?.toLowerCase().includes(searchLower) ||
                    user.role?.toLowerCase().includes(searchLower);
                
                if (!matchesSearch) return false;
            }
            
            // Apply view filter
            switch (this.viewOption) {
                case 'submitted':
                    return user.hasSubmitted;
                case 'pending':
                    return !user.hasSubmitted;
                case 'reviewed':
                    return user.hasManagerResponse;
                default: // 'all'
                    return true;
            }
        });
    }
    
    // Handle search input
    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        this.applyFilters();
    }
    
    // Handle view option change
    handleViewOptionChange(event) {
        this.viewOption = event.detail.value;
        this.applyFilters();
    }
    
    // Clear error message
    clearError() {
        this.error = null;
    }
    
    // Navigate back to the previous forms page
    navigateBack() {
        this[NavigationMixin.Navigate]({
            type: 'standard__navItemPage',
            attributes: {
                apiName: 'View_Previous_Forms'
            }
        });
    }
    
    // Refresh the data
    refreshData() {
        this.loadUserResponses();
    }
    
    // Helper method to show toast notifications
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title,
            message,
            variant
        }));
    }
    
    // Helper method to reduce errors to user-friendly messages
    reduceErrors(errors) {
        if (!Array.isArray(errors)) {
            errors = [errors];
        }
        
        return errors
            .filter(error => !!error)
            .map(error => {
                if (Array.isArray(error.body)) {
                    return error.body.map(e => e.message).join(', ');
                }
                else if (error.body?.message) {
                    return error.body.message;
                }
                else if (error.message) {
                    return error.message;
                }
                return error.toString();
            })
            .join(', ');
    }
    
    // Getters for template
    get hasFormData() {
        return this.formData?.userResponses;
    }
    
    get formName() {
        return this.formData?.formName || 'Untitled Form';
    }

    get formTitle() {
        return this.formData?.formTitle || 'Untitled Form';
    }   
    
    get formDepartment() {
        return this.formData?.formDepartment || 'No department specified';
    }
    
    get questions() {
        return this.formData?.questions || [];
    }
    
    get hasFilteredUsers() {
        return this.filteredUserResponses?.length > 0;
    }
    
    get statusCounts() {
        if (!this.formData?.userResponses) {
            return { total: 0, submitted: 0, pending: 0, reviewed: 0 };
        }
        
        const users = this.formData.userResponses;
        return {
            total: users.length,
            submitted: users.filter(u => u.hasSubmitted).length,
            pending: users.filter(u => !u.hasSubmitted).length,
            reviewed: users.filter(u => u.hasManagerResponse).length
        };
    }
}