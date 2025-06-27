import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getAllForms from '@salesforce/apex/FormController.getAllForms';
import getFilteredForms from '@salesforce/apex/FormController.getFilteredForms';
import getQuestions from '@salesforce/apex/FormController.getQuestions';

export default class ViewPreviousFormAdmin extends NavigationMixin(LightningElement) {
    @track department = "All";
    @track selectedMonth = 0; // 0 means all months
    @track selectedYear = 0; // 0 means all years
    @track filteredForms = [];
    @track isLoading = false;
    
    // State to keep track of whether filters have been applied
    formData = [];
    
    // Lifecycle hook - component connected
    connectedCallback() {
        this.loadAllForms();
    }
    
    // Load all forms initially
    loadAllForms() {
        this.isLoading = true;
        getAllForms()
            .then(result => {
                this.formData = JSON.parse(JSON.stringify(result));
                this.processFormData();
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error loading forms:', error);
                this.isLoading = false;
            });
    }
    
    // Apply filters using Apex method
    applyFilters() {
        this.isLoading = true;
        
        // Convert month and year to integers
        const monthVal = parseInt(this.selectedMonth, 10);
        const yearVal = parseInt(this.selectedYear, 10);
        
        getFilteredForms({ 
            department: this.department === 'All' ? null : this.department,
            month: monthVal,
            year: yearVal
        })
        .then(result => {
            this.formData = JSON.parse(JSON.stringify(result));
            this.processFormData();
            this.isLoading = false;
        })
        .catch(error => {
            console.error('Error applying filters:', error);
            this.isLoading = false;
        });
    }
    
    // Reset all filters
    resetFilters() {
        this.department = 'All';
        this.selectedMonth = 0;
        this.selectedYear = 0;
        this.loadAllForms();
    }
    
    // Process the form data to extract month and year
    processFormData() {
        this.filteredForms = this.formData.map(form => {
            const formCopy = {...form};
            
            // Extract month and year from Applicable_Month__c
            if (form.Applicable_Month__c) {
                const dateObj = new Date(form.Applicable_Month__c);
                formCopy._month = dateObj.getMonth() + 1; // JavaScript months are 0-indexed
                formCopy._year = dateObj.getFullYear();
                formCopy._monthName = this.getMonthName(dateObj.getMonth());
            }
            
            // Initialize question-related properties
            formCopy.showQuestions = false;
            formCopy.isLoadingQuestions = false;
            formCopy.questions = null;
            
            return formCopy;
        });
    }
    
    // Toggle showing/hiding questions for a form
    toggleQuestions(event) {
        const formId = event.currentTarget.dataset.id;
        const formIndex = this.filteredForms.findIndex(form => form.Id === formId);
        
        if (formIndex === -1) return;
        
        const form = this.filteredForms[formIndex];
        
        // If already showing questions, hide them
        if (form.showQuestions) {
            this.filteredForms[formIndex].showQuestions = false;
            event.currentTarget.label = 'View Questions';
            event.currentTarget.iconName = 'utility:preview';
        } else {
            // Otherwise, show questions and load them if not already loaded
            this.filteredForms[formIndex].showQuestions = true;
            event.currentTarget.label = 'Hide Questions';
            event.currentTarget.iconName = 'utility:chevrondown';
            
            if (!form.questions) {
                this.loadQuestionsForForm(formId, formIndex);
            }
        }
        
        // Force refresh to show/hide questions
        this.filteredForms = [...this.filteredForms];
    }
    
    // Load questions for a specific form
    loadQuestionsForForm(formId, formIndex) {
        this.filteredForms[formIndex].isLoadingQuestions = true;
        this.filteredForms = [...this.filteredForms];
        
        getQuestions({ formId: formId })
            .then(result => {
                // Add question number to each question
                const questionsWithNumbers = result.map((question, index) => {
                    return {
                        ...question,
                        index: index + 1  // Add 1-based index
                    };
                });
                
                this.filteredForms[formIndex].questions = questionsWithNumbers;
                this.filteredForms[formIndex].isLoadingQuestions = false;
                this.filteredForms = [...this.filteredForms];
            })
            .catch(error => {
                console.error('Error loading questions:', error);
                this.filteredForms[formIndex].isLoadingQuestions = false;
                this.filteredForms = [...this.filteredForms];
            });
    }
    
    // Navigate to the responses page
    viewResponses(event) {
        const formId = event.currentTarget.dataset.id;
        console.log('Navigating to ViewResponsesPage with formId:', formId);
        
        // Navigate to the view responses page
        this[NavigationMixin.Navigate]({
            type: 'standard__component',
            attributes: {
                componentName: 'c__ViewResponsesPage'
            },
            state: {
                c__formId: formId
            }
        });
    }
    
    // Get month name from month index
    getMonthName(monthIndex) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[monthIndex];
    }
    
    // Event handlers
    handleDepartmentChange(event) { 
        this.department = event.detail.value;
    }
    
    handleMonthChange(event) {
        this.selectedMonth = event.detail.value;
    }
    
    handleYearChange(event) {
        this.selectedYear = event.detail.value;
    }
    
    // Computed properties for displaying forms
    get hasFilteredForms() {
        return this.filteredForms && this.filteredForms.length > 0;
    }
    
    get noFormsMessage() {
        if (this.isLoading) {
            return 'Loading forms...';
        }
        
        if (!this.hasFilteredForms) {
            let message = 'No forms found';
            
            if (this.department !== 'All') {
                message += ` for ${this.department} department`;
            }
            
            if (parseInt(this.selectedMonth, 10) > 0) {
                const monthName = this.getMonthName(parseInt(this.selectedMonth, 10) - 1);
                message += ` in ${monthName}`;
            }
            
            if (parseInt(this.selectedYear, 10) > 0) {
                message += ` for ${this.selectedYear}`;
            }
            
            return message + '.';
        }
        
        return null;
    }
    
    // Options for filters
    get departmentOptionsList() {
        return [
            { label: 'All Departments', value: 'All' },
            { label: 'Technical', value: 'Technical' },
            { label: 'Marketing', value: 'Marketing' },
            { label: 'Sales', value: 'Sales' }
        ];
    }
    
    get monthOptionsList() {
        return [
            { label: 'All Months', value: '0' },
            { label: 'January', value: '1' },
            { label: 'February', value: '2' },
            { label: 'March', value: '3' },
            { label: 'April', value: '4' },
            { label: 'May', value: '5' },
            { label: 'June', value: '6' },
            { label: 'July', value: '7' },
            { label: 'August', value: '8' },
            { label: 'September', value: '9' },
            { label: 'October', value: '10' },
            { label: 'November', value: '11' },
            { label: 'December', value: '12' }
        ];
    }
    
    get yearOptionsList() {
        const currentYear = new Date().getFullYear();
        const years = [{ label: 'All Years', value: '0' }];
        
        // Generate options for the last 5 years
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            years.push({ label: year.toString(), value: year.toString() });
        }
        
        return years;
    }


}