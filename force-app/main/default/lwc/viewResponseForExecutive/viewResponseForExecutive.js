import { LightningElement, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';

export default class ViewResponseForExecutive extends LightningElement {
    @track loading = true;
    @track error;
    @track feedbackResponses = [];
    @track userData = {};
    
   
    
}