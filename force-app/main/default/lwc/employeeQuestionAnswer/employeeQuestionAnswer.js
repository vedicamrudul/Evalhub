import { LightningElement, track } from 'lwc';
import getCurrentUser from '@salesforce/apex/UserController.getCurrentUser';
import getQuestions from '@salesforce/apex/QuestionsController.getQuestions';
import submitFeedback from '@salesforce/apex/QuestionsController.submitFeedback';
import hasExecutiveSubmittedFeedback from '@salesforce/apex/QuestionsController.hasExecutiveSubmittedFeedback';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';


export default class EmployeeQuestionAnswer extends LightningElement {
    @track userData;
    @track questions = [];
    @track error;
    @track isLoading = false;
    @track isSubmitting = false;
    @track isSubmitted = false;

    connectedCallback() {
        this.loadData();
    }

    async loadData() {
        this.isLoading = true;
        try {
            // Get current user data
            const user = await getCurrentUser();
            this.userData = user;
            
            // Check if the user has already submitted feedback
            // You'll need to add a new Apex method for this check
            const hasSubmitted = await hasExecutiveSubmittedFeedback();
            console.log(
                'hasExecutiveSubmittedFeedback: ' + hasSubmitted)
            if (hasSubmitted) {
                // If already submitted, set flag but don't load questions
                this.isSubmitted = true;
                return; // Exit early
            }
            
            // Only load questions if not already submitted
            const questionList = await getQuestions();
            this.questions = questionList.map(q => ({
                ...q,
                isText: q.Input_Type__c === 'Text',
                isNumber: q.Input_Type__c === 'Rating',
                isPicklist: q.Input_Type__c === 'Picklist',
                picklistOptions: this.getPicklistOptions(q.Picklist_Values__c)
            }));
        } catch (err) {
            console.error('Error loading data', err);
            this.error = err?.body?.message || err?.message;
        } finally {
            this.isLoading = false;
        }
    }

    // Helpers for conditional rendering
    isTextInput(type) {
        return type === 'Text';
    }

    isNumber(type) {
        return type === 'Number';
    }

    isPicklist(type) {
        return type === 'Picklist';
    }

    getPicklistOptions(valueString) {
        if (!valueString) return [];
        return valueString.split(',').map(value => ({
            label: value.trim(),
            value: value.trim()
        }));
    }


    // entire logic to submit the answers.
   // Method to collect and submit all answers
handleSubmit() {
    console.log("Submitting answers");
    this.isSubmitting = true; // Set submitting state
    
    // Get all answers
    const inputs = this.template.querySelectorAll('lightning-input[data-id]');
    const comboboxes = this.template.querySelectorAll('lightning-combobox[data-id]');
    
    // Create a **plain array with explicitly defined objects** (not Proxy)
    const answers = [];
    
    // Process inputs
    inputs.forEach(input => {
        const questionId = input.dataset.id;
        const value = input.value;
        
        if (questionId && value) {
            answers.push({
                // Explicitly define properties to match Apex class
                "questionId": questionId,
                "answer": value
            });
        }
    });
    
    // Process comboboxes
    comboboxes.forEach(combobox => {
        const questionId = combobox.dataset.id;
        const value = combobox.value;
        
        if (questionId && value) {
            answers.push({
                "questionId": questionId,
                "answer": value
            });
        }
    });
    
    // Debug the **actual** payload being sent
    console.log('Final answers (JSON):', JSON.stringify(answers));
    
    // Call Apex
    submitFeedback({
    answers: JSON.parse(JSON.stringify(answers)), // Removes Proxy
    respondentId: this.userData.Id
})
    .then(result => {
        // Add these lines to show success message and update isSubmitted
        console.log('Success:', result);
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Feedback submitted successfully',
                variant: 'success'
            })
        );
        this.isSubmitted = true; // Set this to true to show the thank you message
    })
    .catch(error => {
        console.error('Full error:', JSON.stringify(error));
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Error',
                message: error.body?.message || 'An error occurred while submitting feedback',
                variant: 'error'
            })
        );
    })
    .finally(() => {
        this.isLoading = false;
        this.isSubmitting = false; // Reset submitting state
    });
}
}
