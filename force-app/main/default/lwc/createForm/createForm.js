import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createForm from '@salesforce/apex/FormController.createForm';

export default class CreateForm extends LightningElement {
    @track formDetails = {
        title: '',
        department: '',
        applicableMonth: null,
        applicableMonthInput: null
    };
    
    @track questions = [];
    @track showSuccessMessage = false;
    @track createdFormId = '';
    
    departmentOptions = [
        { label: 'Sales', value: 'Sales' },
        { label: 'Marketing', value: 'Marketing' },
        { label: 'Technical', value: 'Technical' },
    ];
    
    inputTypeOptions = [
        { label: 'Text', value: 'Text' },
        { label: 'Picklist', value: 'Picklist' },
        { label: 'Rating', value: 'Number' },
    ];
    
    connectedCallback() {
        // Add one question by default
        this.handleAddQuestion();
    }
    
    handleFormInputChange(event) {
        const field = event.target.name;
        const value = event.target.value;
        this.formDetails = { ...this.formDetails, [field]: value };
        
        // If department changes, update the title if month is already selected
        if (field === 'department' && this.formDetails.applicableMonthInput) {
            this.generateTitle(value, this.formDetails.applicableMonthInput);
        }
    }
    
    handleMonthYearChange(event) {
        // Get the month-year value (format: YYYY-MM)
        const monthYearValue = event.target.value;
        
        if (monthYearValue) {
            // Store the input value
            this.formDetails.applicableMonthInput = monthYearValue;
            
            // Split the value to get year and month
            const [year, month] = monthYearValue.split('-');
            
            // Create a date string with the 1st day of the selected month
            // Format: YYYY-MM-DD (required by Salesforce)
            const formattedDate = `${year}-${month}-01`;
            
            // Update the applicableMonth field with the formatted date
            this.formDetails.applicableMonth = formattedDate;
            
            // Generate title if department is already selected
            if (this.formDetails.department) {
                this.generateTitle(this.formDetails.department, monthYearValue);
            }
        } else {
            // If input is cleared
            this.formDetails.applicableMonthInput = null;
            this.formDetails.applicableMonth = null;
            this.formDetails.title = '';
        }
    }
    
    generateTitle(department, monthYearValue) {
        if (!department || !monthYearValue) return;
        
        // Split the monthYearValue to get year and month number
        const [year, monthNum] = monthYearValue.split('-');
        
        // Convert month number to month name
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[parseInt(monthNum) - 1];
        
        // Generate title in format: "Department Feedback Month Year"
        this.formDetails.title = `${department} Feedback ${monthName} ${year}`;
    }
    
    handleQuestionChange(event) {
        const field = event.target.name;
        const value = event.target.value;
        const index = event.target.dataset.index;
        
        this.questions = this.questions.map((question, i) => {
            if (i === parseInt(index)) {
                let updatedQuestion = { ...question, [field]: value };
                // Update the showPicklistValues property if inputType changed
                if (field === 'inputType') {
                    updatedQuestion.showPicklistValues = value === 'Picklist';
                }
                return updatedQuestion;
            }
            return question;
        });
    }
    
    handleAddQuestion() {
        const newId = Date.now().toString();
        const newQuestionNumber = this.questions.length + 1;
        this.questions.push({
            id: newId,
            questionText: '',
            inputType: 'Text',
            picklistValues: '',
            showPicklistValues: false,
            displayNumber: newQuestionNumber
        });
    }
    
    handleDeleteQuestion(event) {
        const index = event.target.dataset.index;
        this.questions = this.questions.filter((_, i) => i !== parseInt(index))
            .map((question, i) => {
                // Update the displayNumber to maintain sequential numbering
                return { ...question, displayNumber: i + 1 };
            });
    }
    
    get isSubmitDisabled() {
        const formValid = this.formDetails.title && 
                          this.formDetails.department && 
                          this.formDetails.applicableMonth;
        
        const questionsValid = this.questions.length > 0 && 
                              !this.questions.some(q => !q.questionText || !q.inputType);
        
        return !(formValid && questionsValid);
    }
    
    handleSubmit() {
        // Prepare the data for the Apex method
        const formWrapper = {
            title: this.formDetails.title,
            department: this.formDetails.department,
            applicableMonth: this.formDetails.applicableMonth
        };
        
        const questionWrappers = this.questions.map(q => {
            return {
                questionText: q.questionText,
                inputType: q.inputType,
                picklistValues: q.inputType === 'Picklist' ? q.picklistValues : null
            };
        });
        
        // Call the Apex method
        createForm({ formWrapper, questionWrappers })
            .then(result => {
                this.createdFormId = result;
                this.showSuccessMessage = true;
                
                // Show toast message
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Form created successfully',
                        variant: 'success'
                    })
                );
                
                // Reset the form
                this.resetForm();
            })
            .catch(error => {
                console.error('Error creating form:', error);
                
                // Check if it's the duplicate form error
                const errorMsg = error.body && error.body.message || 'Unknown error';
                const isDuplicateFormError = errorMsg.includes('A form already exists for this department and month');
                
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: isDuplicateFormError ? 
                            'A form already exists for this department and month' : 
                            errorMsg,
                        variant: 'error'
                    })
                );
            });
    }
    
    resetForm() {
        this.formDetails = {
            title: '',
            department: '',
            applicableMonth: null,
            applicableMonthInput: null
        };
        
        this.questions = [{
            id: Date.now().toString(),
            questionText: '',
            inputType: 'Text',
            picklistValues: '',
            showPicklistValues: false,
            displayNumber: 1
        }];
        
        // Hide success message after 5 seconds
        setTimeout(() => {
            this.showSuccessMessage = false;
        }, 5000);
    }
}