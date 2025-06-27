import { LightningElement, wire, track } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import getAllUserResponsesForAdmin from '@salesforce/apex/QuestionsController.getAllUserResponsesForAdmin';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ViewResponsesPage extends NavigationMixin(LightningElement) {
    @track isLoading = false;
    @track formData;
    @track error;
    @track selectedUserId;
    @track formId;
    @track searchTerm = '';
    @track viewOption = 'all'; // all, submitted, pending
    @track filteredUserResponses = [];
    
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
            // Get form ID from URL parameters if available
            // Check for both formId and c__formId (with namespace prefix)
            console.log('Page reference state:', JSON.stringify(pageRef.state));
            
            // Look for the form ID in various possible formats
            this.formId = pageRef.state?.formId || 
                          pageRef.state?.c__formId ||
                          pageRef.state?.['c__formId']; // Using array notation for key with special characters
                          
            console.log('Form ID from page reference:', this.formId);
            
            if (this.formId) {
                this.loadUserResponses();
            } else {
                // Show an error if no form ID is found
                this.error = 'No form selected. Please select a form from the previous page.';
                console.error('No form ID found in URL parameters');
            }
        }
    }
    
    // Load user responses from server
    loadUserResponses() {
        if (!this.formId) {
            this.error = 'No form selected. Please select a form from the previous page.';
            console.error('Cannot load user responses: No form ID provided');
            return;
        }
        
        console.log('Loading user responses for form ID:', this.formId);
        this.isLoading = true;
        this.error = null; // Clear any previous errors
        
        getAllUserResponsesForAdmin({ formId: this.formId })
            .then(result => {
                console.log('User responses loaded successfully');
                this.formData = result;
                this.processUserResponsesData();
                this.applyFilters();
                this.isLoading = false;
                
                // Show success message
                if (result && result.userResponses && result.userResponses.length > 0) {
                    this.showToast('Success', `Loaded ${result.userResponses.length} user responses`, 'success');
                } else {
                    this.showToast('Information', 'No user responses found for this form', 'info');
                }
            })
            .catch(error => {
                this.error = this.reduceErrors(error);
                console.error('Error loading user responses:', this.error);
                this.showToast('Error', this.error, 'error');
                this.isLoading = false;
            });
    }
    
    // Process user responses data to add computed properties
    processUserResponsesData() {
        if (!this.formData || !this.formData.userResponses) return;
        
        // Create a deep clone to ensure objects are extensible
        this.formData = JSON.parse(JSON.stringify(this.formData));
        
        this.formData.userResponses.forEach(user => {
            // Add helper properties to each response
            if (user.questionResponses) {
                user.questionResponses.forEach(response => {
                    // Check if answer exists and is not empty
                    response.isAnswered = !!response.answer && response.answer.trim() !== '';
                });
            }
        });
    }
    
    // Apply filters based on search term and selected view
    applyFilters() {
        if (!this.formData || !this.formData.userResponses) return;
        
        const searchLower = this.searchTerm.toLowerCase();
        
        this.filteredUserResponses = this.formData.userResponses.filter(user => {
            // Apply search filter
            const nameMatch = user.userName.toLowerCase().includes(searchLower);
            const departmentMatch = user.department?.toLowerCase().includes(searchLower);
            const roleMatch = user.role?.toLowerCase().includes(searchLower);
            
            if (searchLower && !nameMatch && !departmentMatch && !roleMatch) {
                return false;
            }
            
            // Apply view filter
            if (this.viewOption === 'submitted' && !user.hasSubmitted) {
                return false;
            }
            if (this.viewOption === 'pending' && user.hasSubmitted) {
                return false;
            }
            if (this.viewOption === 'reviewed' && !user.hasManagerResponse) {
                return false;
            }
            
            // Add isSelected property for conditionals in the template
            user.isSelected = this.selectedUserId === user.userId;
            
            return true;
        });
    }
    
    // Handle search input
    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        this.applyFilters();
    }
    
    // Handle view option change
    handleViewOptionChange(event) {
        this.viewOption = event.target.value;
        this.applyFilters();
    }
    
    // Handle click on user card to show details
    handleUserClick(event) {
        const userId = event.currentTarget.dataset.userId;
        this.selectedUserId = this.selectedUserId === userId ? null : userId;
        this.applyFilters(); // Update isSelected property for all users
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
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
    
    // Helper method to reduce errors to user-friendly messages
    reduceErrors(errors) {
        if (!Array.isArray(errors)) {
            errors = [errors];
        }
        
        return errors
            .filter(error => !!error)
            .map(error => {
                // UI API read errors
                if (Array.isArray(error.body)) {
                    return error.body.map(e => e.message).join(', ');
                }
                // Page level errors
                else if (error.body && typeof error.body.message === 'string') {
                    return error.body.message;
                }
                // JS errors
                else if (typeof error.message === 'string') {
                    return error.message;
                }
                // Unknown error shape
                return String(error);
            })
            .join(', ');
    }
    
    // Getters for template
    get hasFormData() {
        return this.formData && this.formData.userResponses;
    }
    
    get formName() {
        return this.formData?.formName;
    }
    
    get formDepartment() {
        return this.formData?.formDepartment;
    }
    
    get questions() {
        return this.formData?.questions || [];
    }
    
    get hasFilteredUsers() {
        return this.filteredUserResponses && this.filteredUserResponses.length > 0;
    }
    
    get statusCounts() {
        if (!this.formData || !this.formData.userResponses) return { total: 0, submitted: 0, pending: 0, reviewed: 0 };
        
        const users = this.formData.userResponses;
        return {
            total: users.length,
            submitted: users.filter(u => u.hasSubmitted).length,
            pending: users.filter(u => !u.hasSubmitted).length,
            reviewed: users.filter(u => u.hasManagerResponse).length
        };
    }
}