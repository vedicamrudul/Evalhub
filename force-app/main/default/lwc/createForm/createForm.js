import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createForm from '@salesforce/apex/FormController.createForm';

export default class CreateForm extends LightningElement {
    @track formDetails = {
        title: '',
        department: '',
        applicableMonth: null
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
        this.questions.push({
            id: newId,
            questionText: '',
            inputType: 'Text',
            picklistValues: '',
            showPicklistValues: false
        });
    }
    
    handleDeleteQuestion(event) {
        const index = event.target.dataset.index;
        this.questions = this.questions.filter((_, i) => i !== parseInt(index));
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
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error creating form',
                        message: error.body ? error.body.message : 'Unknown error',
                        variant: 'error'
                    })
                );
            });
    }
    
    resetForm() {
        this.formDetails = {
            title: '',
            department: '',
            applicableMonth: null
        };
        
        this.questions = [{
            id: Date.now().toString(),
            questionText: '',
            inputType: 'Text',
            picklistValues: '',
            showPicklistValues: false
        }];
        
        // Hide success message after 5 seconds
        setTimeout(() => {
            this.showSuccessMessage = false;
        }, 5000);
    }
}