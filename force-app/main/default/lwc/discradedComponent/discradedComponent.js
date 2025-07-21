import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getFilteredForms from '@salesforce/apex/FormController.getFilteredForms';
import getQuestions from '@salesforce/apex/FormController.getQuestions';
import getCurrentUser from '@salesforce/apex/UserController.getCurrentUser';
import  getQuestionsByFormId  from '@salesforce/apex/QuestionsController.getQuestionsByFormId';

export default class ViewPreviousFormAdmin extends NavigationMixin(LightningElement) {
  
    @track selectedMonth = 0;
    @track selectedYear = 0;
    @track filteredForms = [];
    @track isLoading = false;
    userData = {};
    
    formData = [];
    
    async connectedCallback() {
            const user= await getCurrentUser();
            this.userData = user;
            this.applyFilters();
    }
        
    applyFilters() {
        this.isLoading = true;
        
        const monthVal = parseInt(this.selectedMonth, 10);
        const yearVal = parseInt(this.selectedYear, 10);
        
        getFilteredForms({ 
            department: this.userData.department__c,
            month: monthVal? monthVal : 0,
            year: yearVal? yearVal : 0
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
    
    resetFilters() {
        this.selectedMonth = 0;
        this.selectedYear = 0;
        this.loadFilteredForms();
    }
    
    processFormData() {
        this.filteredForms = this.formData.map(form => {
            const formCopy = {...form};
            
            if (form.Applicable_Month__c) {
                const dateObj = new Date(form.Applicable_Month__c);
                formCopy._month = dateObj.getMonth() + 1;
                formCopy._year = dateObj.getFullYear();
                formCopy._monthName = this.getMonthName(dateObj.getMonth());
            }
            return formCopy;
        });
    }
   
    handleViewMyResponse(event) {
        const formId = event.currentTarget.dataset.id;
        getQuestionsByFormId({ formId: formId })
        .then(result => {
            console.log('Questions:', result);
        })
        .catch(error => {
            console.error('Error getting questions:', error);
        });
    }
    
    getMonthName(monthIndex) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[monthIndex];
    }
    
    handleMonthChange(event) {
        this.selectedMonth = event.detail.value;
    }
    
    handleYearChange(event) {
        this.selectedYear = event.detail.value;
    }
    
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
        
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            years.push({ label: year.toString(), value: year.toString() });
        }
        
        return years;
    }
}