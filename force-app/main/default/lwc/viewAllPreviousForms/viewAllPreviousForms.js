import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getCurrentUserPermissions from '@salesforce/apex/QuestionsController.getCurrentUserPermissions';
import getFormsBasedOnUserRole from '@salesforce/apex/QuestionsController.getFormsBasedOnUserRole';
import getFilteredFormsBasedOnUserRole from '@salesforce/apex/QuestionsController.getFilteredFormsBasedOnUserRole';
import getQuestions from '@salesforce/apex/FormController.getQuestions';

export default class ViewAllPreviousForms extends NavigationMixin(LightningElement) {
    @track department = "All";
    @track selectedMonth = 0;
    @track selectedYear = 0;
    @track filteredForms = [];
    @track isLoading = false;
    @track userPermissions = {};
    @track error;
    
    formData = [];
    
    connectedCallback() {
        this.loadUserPermissions();
    }

    async loadUserPermissions() {
        try {
            this.userPermissions = await getCurrentUserPermissions();
            
            if (!this.userPermissions.canViewAllDepartments) {
                this.department = this.userPermissions.userDepartment || 'All';
            }
            
            this.loadAllForms();
        } catch (error) {
            console.error('Error loading user permissions:', error);
            this.error = 'Error loading user permissions: ' + (error.body?.message || error.message);
        }
    }
    
    loadAllForms() {
        this.isLoading = true;
        getFormsBasedOnUserRole()
            .then(result => {
                this.formData = JSON.parse(JSON.stringify(result));
                this.processFormData();
                this.isLoading = false;
                this.error = null;
            })
            .catch(error => {
                console.error('Error loading forms:', error);
                this.error = 'Error loading forms: ' + (error.body?.message || error.message);
                this.isLoading = false;
            });
    }
    
    applyFilters() {
        this.isLoading = true;
        
        const monthVal = parseInt(this.selectedMonth, 10);
        const yearVal = parseInt(this.selectedYear, 10);
        
        const deptToFilter = this.userPermissions.canViewAllDepartments ? 
            (this.department === 'All' ? null : this.department) : 
            this.userPermissions.userDepartment;
        
        getFilteredFormsBasedOnUserRole({ 
            department: deptToFilter,
            month: monthVal,
            year: yearVal
        })
        .then(result => {
            this.formData = JSON.parse(JSON.stringify(result));
            this.processFormData();
            this.isLoading = false;
            this.error = null;
        })
        .catch(error => {
            console.error('Error applying filters:', error);
            this.error = 'Error applying filters: ' + (error.body?.message || error.message);
            this.isLoading = false;
        });
    }
    
    resetFilters() {
        if (this.userPermissions.canViewAllDepartments) {
            this.department = 'All';
        } else {
            this.department = this.userPermissions.userDepartment || 'All';
        }
        this.selectedMonth = 0;
        this.selectedYear = 0;
        this.loadAllForms();
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
            
            formCopy.showQuestions = false;
            formCopy.isLoadingQuestions = false;
            formCopy.questions = null;
            
            return formCopy;
        });
    }
    
    toggleQuestions(event) {
        const formId = event.currentTarget.dataset.id;
        const formIndex = this.filteredForms.findIndex(form => form.Id === formId);
        
        if (formIndex === -1) return;
        
        const form = this.filteredForms[formIndex];
        
        if (form.showQuestions) {
            this.filteredForms[formIndex].showQuestions = false;
            event.currentTarget.label = 'View Questions';
            event.currentTarget.iconName = 'utility:preview';
        } else {
            this.filteredForms[formIndex].showQuestions = true;
            event.currentTarget.label = 'Hide Questions';
            event.currentTarget.iconName = 'utility:chevrondown';
            
            if (!form.questions) {
                this.loadQuestionsForForm(formId, formIndex);
            }
        }
        
        this.filteredForms = [...this.filteredForms];
    }
    
    loadQuestionsForForm(formId, formIndex) {
        this.filteredForms[formIndex].isLoadingQuestions = true;
        this.filteredForms = [...this.filteredForms];
        
        getQuestions({ formId: formId })
            .then(result => {
                const questionsWithNumbers = result.map((question, index) => {
                    return {
                        ...question,
                        index: index + 1
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
    
    viewResponses(event) {
        const formId = event.currentTarget.dataset.id;
        console.log('Navigating to ViewResponsesPage with formId:', formId);
        
        this[NavigationMixin.Navigate]({
            type: 'standard__navItemPage',
            attributes: {
                apiName: 'view_responses'
            },
            state: {
                c__formId: formId
            }
        });
    }
    
    getMonthName(monthIndex) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[monthIndex];
    }
    
    handleDepartmentChange(event) { 
        this.department = event.detail.value;
    }
    
    handleMonthChange(event) {
        this.selectedMonth = event.detail.value;
    }
    
    handleYearChange(event) {
        this.selectedYear = event.detail.value;
    }

    clearError() {
        this.error = null;
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
    
    get departmentOptionsList() {
        if (!this.userPermissions.canViewAllDepartments) {
            return [
                { label: this.userPermissions.userDepartment || 'My Department', 
                  value: this.userPermissions.userDepartment || 'All' }
            ];
        }
        
        return [
            { label: 'All Departments', value: 'All' },
            { label: 'Technical', value: 'Technical' },
            { label: 'Marketing', value: 'Marketing' },
            { label: 'Sales', value: 'Sales' }
        ];
    }

    get showDepartmentFilter() {
        return this.userPermissions.canViewAllDepartments;
    }

    get hideDepartmentFilter() {
        return !this.userPermissions.canViewAllDepartments;
    }

    get userRoleLabel() {
        return this.userPermissions.userRole || 'User';
    }

    get accessLevelLabel() {
        if (this.userPermissions.canViewAllDepartments) {
            return 'Executive Access - All Departments';
        } else {
            return `Department Access - ${this.userPermissions.userDepartment || 'Your Department'}`;
        }
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