import { LightningElement, wire, track } from 'lwc';
import getEmployeeSubmittedFeedback from '@salesforce/apex/QuestionsController.getEmployeeSubmittedFeedback';
import { getRecord } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import NAME_FIELD from '@salesforce/schema/User.Name';
import DEPARTMENT_FIELD from '@salesforce/schema/User.department__c';

export default class ViewResponseForExecutive extends LightningElement {
    @track loading = true;
    @track error;
    @track feedbackResponses = [];
    @track userData = {};
    
    @wire(getRecord, { recordId: USER_ID, fields: [NAME_FIELD, DEPARTMENT_FIELD] })
    wireUser({ error, data }) {
        if (data) {
            this.userData = {
                name: data.fields.Name.value,
                department: data.fields.department__c.value
            };
            this.loading = false;
        } else if (error) {
            this.error = 'Error loading user information: ' + this.reduceErrors(error);
            this.loading = false;
        }
    }
    
    @wire(getEmployeeSubmittedFeedback)
    wiredFeedback({ error, data }) {
        this.loading = true;
        if (data) {
            this.feedbackResponses = data;
            this.error = undefined;
            this.loading = false;
        } else if (error) {
            this.error = 'Error retrieving feedback' 
            this.feedbackResponses = [];
            this.loading = false;
        }
    }
    
    get hasResponses() {
        return this.feedbackResponses && this.feedbackResponses.length > 0;
    }
    
    get hasError() {
        return this.error !== undefined && this.error !== null && this.error !== '';
    }
    
}