import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createForm from '@salesforce/apex/FormController.createForm';
import getInputTypesFromMetadata from '@salesforce/apex/FormController.getInputTypesFromMetadata';

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
    @track inputTypeOptions = [];
    @track scaleConfigurations = {};
    @track picklistGroups = [];
    @track isLoadingMetadata = true;
    
    departmentOptions = [
        { label: 'Sales', value: 'Sales' },
        { label: 'Marketing', value: 'Marketing' },
        { label: 'Technical', value: 'Technical' },
    ];

    get picklistTypeOptions() {
        return this.picklistGroups;
    }
    
    connectedCallback() {
        this.loadInputTypesMetadata();
    }

    async loadInputTypesMetadata() {
        try {
            
            const metadataResult = await getInputTypesFromMetadata();
            this.inputTypeOptions = metadataResult.inputTypeOptions;
            this.scaleConfigurations = metadataResult.scaleConfigurations;
            this.picklistGroups = metadataResult.picklistGroups || [];
            this.isLoadingMetadata = false;

            this.handleAddQuestion();
        } catch (error) {
            console.error('Error loading input types metadata:', error);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Failed to load input types configuration',
                    variant: 'error'
                })
            );
            this.isLoadingMetadata = false;
        }
    }
    
    handleFormInputChange(event) {
        const field = event.target.name;
        const value = event.target.value;
        this.formDetails = { ...this.formDetails, [field]: value };
        
        if (field === 'department' && this.formDetails.applicableMonthInput) {
            this.generateTitle(value, this.formDetails.applicableMonthInput);
        }
    }
    
    handleMonthYearChange(event) {
        const monthYearValue = event.target.value;
        
        if (monthYearValue) {
            this.formDetails.applicableMonthInput = monthYearValue;
            
            const [year, month] = monthYearValue.split('-');
            
            const formattedDate = `${year}-${month}-01`;
            
            this.formDetails.applicableMonth = formattedDate;
            
            if (this.formDetails.department) {
                this.generateTitle(this.formDetails.department, monthYearValue);
            }
        } else {
            this.formDetails.applicableMonthInput = null;
            this.formDetails.applicableMonth = null;
            this.formDetails.title = '';
        }
    }
    
    generateTitle(department, monthYearValue) {
        if (!department || !monthYearValue) return;
        
        const [year, monthNum] = monthYearValue.split('-');
        
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[parseInt(monthNum) - 1];
        
        this.formDetails.title = `${department} Feedback ${monthName} ${year}`;
    }
    
    handleQuestionChange(event) {
        const field = event.target.name;
        const value = event.target.value;
        const index = event.target.dataset.index;
        
        this.questions = this.questions.map((question, i) => {
            if (i === parseInt(index)) {
                let updatedQuestion = { ...question, [field]: value };
                if (field === 'inputType') {
                    updatedQuestion.showPicklistValues = value === 'Picklist';
                    updatedQuestion.showScaleGroup = value !== 'Text' && value !== 'Picklist' && value !== 'Slider';
                    updatedQuestion.scaleGroup = '';
                    updatedQuestion.picklistValues = '';
                    updatedQuestion.picklistType = '';
                    updatedQuestion.showCustomPicklistValues = false;
                    updatedQuestion.scaleGroupOptions = this.getScaleGroupOptions(value);
                    updatedQuestion.picklistTypeOptions = [...this.picklistGroups];
                }
                
                if (field === 'picklistType') {
                    updatedQuestion.showCustomPicklistValues = value === 'Custom';
                    if (value !== 'Custom') {
                        updatedQuestion.picklistValues = '';
                    }
                }
                
                updatedQuestion.previewData = this.generatePreviewData(updatedQuestion.inputType, updatedQuestion.scaleGroup);
                
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
            picklistType: '',
            scaleGroup: '',
            showPicklistValues: false,
            showCustomPicklistValues: false,
            showScaleGroup: false,
            scaleGroupOptions: [],
            picklistTypeOptions: [...this.picklistGroups],
            scaleGroupKey: `scaleGroup-${newId}`,
            picklistKey: `picklist-${newId}`,
            displayNumber: newQuestionNumber,
            previewData: this.generatePreviewData('Text', '')
        });
    }

    getScaleGroupOptions(inputType) {
        if (!this.scaleConfigurations || !this.scaleConfigurations[inputType]) {
            return [];
        }
        
        const groups = new Set();
        this.scaleConfigurations[inputType].forEach(config => {
            groups.add(config.scaleGroup);
        });
        
        return Array.from(groups).map(group => ({
            label: group.replace(/_/g, ' '),
            value: group
        }));
    }

    generatePreviewData(inputType, scaleGroup) {
        if (!inputType || !scaleGroup || !this.scaleConfigurations) {
            return { showPreview: false, options: [] };
        }

        const configs = this.scaleConfigurations[inputType] || [];
        const groupConfigs = configs.filter(config => config.scaleGroup === scaleGroup);
        
        if (groupConfigs.length === 0) {
            return { showPreview: false, options: [] };
        }

        const sortedConfigs = groupConfigs.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        if (inputType === 'Emoji') {
            return {
                showPreview: true,
                isEmoji: true,
                isRating: false,
                options: sortedConfigs.map(config => ({
                    label: config.displayLabel || config.label,
                    value: config.valueStored || config.displayLabel || '😊'
                }))
            };
        } else if (inputType === 'Rating') {
            const icon = sortedConfigs[0] ? (sortedConfigs[0].valueStored || '⭐') : '⭐';
            return {
                showPreview: true,
                isEmoji: false,
                isRating: true,
                options: Array.from({length: 5}, (_, index) => ({
                    label: icon,
                    value: (index + 1).toString()
                }))
            };
        }

        return { showPreview: false, options: [] };
    }
    
    handleDeleteQuestion(event) {
        const index = event.target.dataset.index;
        this.questions = this.questions.filter((_, i) => i !== parseInt(index))
            .map((question, i) => {
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
        const invalidQuestions = this.questions.filter(q => q.questionText.length > 255 );
        const invalidPicklistValues = this.questions.filter(q => q.picklistValues && q.picklistValues.length > 100);

        if (invalidPicklistValues.length > 0) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'One or more picklist values exceed the 100 character limit. Please shorten them before submitting.',
                    variant: 'error'
                })
            );
            return;
        }
        if (invalidQuestions.length > 0) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'One or more questions exceed the 255 character limit. Please shorten them before submitting.',
                    variant: 'error'
                })
            );
            return;
        }

        const formWrapper = {
            title: this.formDetails.title,
            department: this.formDetails.department,
            applicableMonth: this.formDetails.applicableMonth
        };
        
        const questionWrappers = this.questions.map(q => {
            return {
                questionText: q.questionText,
                inputType: q.inputType,
                picklistValues: q.inputType === 'Picklist' && q.picklistType === 'Custom' ? q.picklistValues : null,
                picklistType: q.inputType === 'Picklist' ? q.picklistType : null,
                scaleGroup: q.inputType !== 'Text' && q.inputType !== 'Picklist' && q.inputType !== 'Slider' ? q.scaleGroup : null
            };
        });
        
        createForm({ formWrapper, questionWrappers })
            .then(result => {
                this.createdFormId = result;
                this.showSuccessMessage = true;
                
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Form created successfully',
                        variant: 'success'
                    })
                );
                
                this.resetForm();
            })
            .catch(error => {
                console.error('Error creating form:', error);
                
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
        
        const resetId = Date.now().toString();
        this.questions = [{
            id: resetId,
            questionText: '',
            inputType: 'Text',
            picklistValues: '',
            picklistType: '',
            scaleGroup: '',
            showPicklistValues: false,
            showCustomPicklistValues: false,
            showScaleGroup: false,
            scaleGroupOptions: [],
            picklistTypeOptions: [...this.picklistGroups],
            scaleGroupKey: `scaleGroup-${resetId}`,
            picklistKey: `picklist-${resetId}`,
            displayNumber: 1,
            previewData: this.generatePreviewData('Text', '')
        }];
        
        setTimeout(() => {
            this.showSuccessMessage = false;
        }, 5000);
    }
}