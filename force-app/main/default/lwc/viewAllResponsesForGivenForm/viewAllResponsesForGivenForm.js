import { LightningElement, wire, track } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import getAllUserResponsesForAdminWithPermissions from '@salesforce/apex/QuestionsController.getAllUserResponsesForAdminWithPermissions';
import getCurrentUserPermissions from '@salesforce/apex/QuestionsController.getCurrentUserPermissions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ViewAllResponsesForGivenForm extends NavigationMixin(LightningElement) {
    @track isLoading = false;
    @track formData;
    @track error;
    @track searchTerm = '';
    @track viewOption = 'all';
    @track userPermissions = {};
    
    @track selectedRegion = '';
    @track selectedCluster = '';
    @track selectedBranch = '';
    @track RegionOptions = [];
    @track ClusterOptions = [];
    @track branchOptions = [];
    @track isCBO = false;
    
    get viewOptions() {
        const baseOptions = [
            { label: 'All', value: 'all' },
            { label: 'Submitted', value: 'submitted' },
            { label: 'Pending', value: 'pending' },
            { label: 'Reviewed', value: 'reviewed' }
        ];

        if (this.userPermissions && !this.userPermissions.canViewAllDepartments) {
            baseOptions.push({ label: 'My Response Only', value: 'myresponse' });
        }

        return baseOptions;
    }

    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        if (pageRef) {
            this.formId = pageRef.state?.c__formId;
            
            if (this.formId) {
                this.loadUserPermissions();
            } else {
                this.error = 'No form selected. Please select a form from the previous page.';
                console.error('No form ID found in URL parameters');
            }
        }
    }

    async loadUserPermissions() {
        try {
            this.userPermissions = await getCurrentUserPermissions();
            this.loadUserResponses();
        } catch (error) {
            console.error('Error loading user permissions:', error);
            this.error = 'Error loading user permissions: ' + (error.body?.message || error.message);
        }
    }
        
    loadUserResponses() {
        if (!this.formId) {
            this.error = 'No form selected. Please select a form from the previous page.';
            return;
        }
        
        this.isLoading = true;
        this.error = null;
        
        getAllUserResponsesForAdminWithPermissions({ formId: this.formId })
            .then(result => {
                this.formData = result;
                this.isCBO = result.isCBO || false;
                
                if (this.isCBO && this.userPermissions.canViewBranchFilters) {
                    this.processBranchFilterOptions(result);
                }
                
                this.processUserResponsesData();
                this.applyFilters();
                
                if (result?.userResponses?.length > 0) {
                    this.showToast('Success', `Loaded ${result.userResponses.length} user responses`, 'success');
                } else {
                    this.showToast('Info', 'No user responses found for this form', 'info');
                }
            })
            .catch(error => {
                this.error = this.reduceErrors(error);
                this.showToast('Error', this.error, 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
    processBranchFilterOptions(result) {
        this.RegionOptions = [{ label: 'All Zones', value: '' }, ...(result.RegionOptions || [])];
        this.ClusterOptions = [{ label: 'All Clusters', value: '' }, ...(result.ClusterOptions || [])];
        this.branchOptions = [{ label: 'All Branches', value: '' }, ...(result.branchOptions || [])];
    }
    
    processUserResponsesData() {
        if (!this.formData?.userResponses) return;
        
        this.formData = JSON.parse(JSON.stringify(this.formData));
        
        const questionMap = {};
        if (this.formData.questions) {
            this.formData.questions.forEach(question => {
                questionMap[question.id] = question;
            });
        }
        
        this.formData.userResponses.forEach(user => {
            const responseMap = {};
            if (user.questionResponses) {
                user.questionResponses.forEach(response => {
                    response.isAnswered = !!response.answer && response.answer.trim() !== '';
                    if (response.questionId) {
                        responseMap[response.questionId] = response;
                    }
                });
            }
            
            user._responseMap = responseMap;
            
            user.formattedAnswers = [];
            if (this.formData.questions) {
                this.formData.questions.forEach(question => {
                    const response = responseMap[question.id];
                    let formattedText = 'No answer provided';
                    
                    if (response?.isAnswered) {
                        formattedText = this.formatResponseByType(response.answer, question.type);
                    }
                    
                    user.formattedAnswers.push({
                        questionId: question.id,
                        text: formattedText,
                        isAnswered: response?.isAnswered || false
                    });
                });
            }
        });
    }
    
    formatResponseByType(answer, inputType) {
        if (!answer) return 'No answer provided';
        
        switch (inputType) {
            case 'Rating':
                return this.formatRatingForAdmin(answer);
            case 'Slider':
                return `${answer}/10`;
            case 'Emoji':
                return answer;
            case 'Text':
            case 'Picklist':
            default:
                return answer;
        }
    }

    formatRatingForAdmin(answer) {
        if (answer && answer.startsWith('rating//')) {
            const parts = answer.split('//');
            if (parts.length === 3) {
                const ratingValue = parseInt(parts[2]);
                if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
                    return `${ratingValue}/5`;
                }
            }
        }
        
        const ratingValue = parseInt(answer);
        if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
            return `${ratingValue}/5`;
        }
        
        if (answer.includes('out of')) {
            return answer.replace('out of', '/');
        }
        
        return answer;
    }

    applyFilters() {
        if (!this.formData?.userResponses) {
            this.filteredUserResponses = [];
            return;
        }
        
        const searchLower = this.searchTerm?.toLowerCase() || '';
        
        this.filteredUserResponses = this.formData.userResponses.filter(user => {
            if (searchLower) {
                const matchesSearch = 
                    user.userName?.toLowerCase().includes(searchLower) ||
                    user.department?.toLowerCase().includes(searchLower) ||
                    user.role?.toLowerCase().includes(searchLower);
                
                if (!matchesSearch) return false;
            }
            
            if (this.isCBO && this.userPermissions.canViewBranchFilters) {
                if (this.selectedRegion && user.branch?.Region !== this.selectedRegion) {
                    return false;
                }
                
                if (this.selectedCluster && user.branch?.Cluster !== this.selectedCluster) {
                    return false;
                }
                
                if (this.selectedBranch && user.branch?.branchName !== this.selectedBranch) {
                    return false;
                }
            }
            
            switch (this.viewOption) {
                case 'submitted':
                    return user.hasSubmitted;
                case 'pending':
                    return !user.hasSubmitted;
                case 'reviewed':
                    return user.hasManagerResponse;
                case 'myresponse':
                    return user.userId === this.userPermissions.userId;
                default:
                    return true;
            }
        });
    }
    
    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        this.applyFilters();
    }
    
    handleViewOptionChange(event) {
        this.viewOption = event.detail.value;
        this.applyFilters();
    }
    
    handleRegionFilterChange(event) {
        this.selectedRegion = event.detail.value;
        this.selectedCluster = '';
        this.selectedBranch = '';
        this.updateDependentFilters();
        this.applyFilters();
    }
    
    handleClusterFilterChange(event) {
        this.selectedCluster = event.detail.value;
        this.selectedBranch = '';
        this.updateDependentFilters();
        this.applyFilters();
    }
    
    handleBranchFilterChange(event) {
        this.selectedBranch = event.detail.value;
        this.applyFilters();
    }
    
    updateDependentFilters() {
        if (!this.isCBO || !this.formData || !this.userPermissions.canViewBranchFilters) return;
        
        const allUsers = this.formData.userResponses || [];
        
        let availableClusters = new Set();
        allUsers.forEach(user => {
            if (user.branch && (!this.selectedRegion || user.branch.Region === this.selectedRegion)) {
                if (user.branch.Cluster) {
                    availableClusters.add(user.branch.Cluster);
                }
            }
        });
        
        this.ClusterOptions = [
            { label: 'All Clusters', value: '' },
            ...Array.from(availableClusters).map(Cluster => ({ label: Cluster, value: Cluster }))
        ];
        
        let availableBranches = new Set();
        allUsers.forEach(user => {
            if (user.branch && 
                (!this.selectedRegion || user.branch.Region === this.selectedRegion) &&
                (!this.selectedCluster || user.branch.Cluster === this.selectedCluster)) {
                if (user.branch.branchName) {
                    availableBranches.add(user.branch.branchName);
                }
            }
        });
        
        this.branchOptions = [
            { label: 'All Branches', value: '' },
            ...Array.from(availableBranches).map(branch => ({ label: branch, value: branch }))
        ];
    }
    
    clearError() {
        this.error = null;
    }
    
    navigateBack() {
        this[NavigationMixin.Navigate]({
            type: 'standard__navItemPage',
            attributes: {
                apiName: 'view_all_previous_forms'
            }
        });
    }
    
    refreshData() {
        if (this.isCBO && this.userPermissions.canViewBranchFilters) {
            this.selectedRegion = '';
            this.selectedCluster = '';
            this.selectedBranch = '';
        }
        this.loadUserResponses();
    }
    
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title,
            message,
            variant
        }));
    }
    
    reduceErrors(errors) {
        if (!Array.isArray(errors)) {
            errors = [errors];
        }
        
        return errors
            .filter(error => !!error)
            .map(error => {
                if (Array.isArray(error.body)) {
                    return error.body.map(e => e.message).join(', ');
                }
                else if (error.body?.message) {
                    return error.body.message;
                }
                else if (error.message) {
                    return error.message;
                }
                return error.toString();
            })
            .join(', ');
    }
    
    get hasFormData() {
        return this.formData?.userResponses;
    }
    
    get formName() {
        return this.formData?.formName || 'Untitled Form';
    }

    get formTitle() {
        return this.formData?.formTitle || 'Untitled Form';
    }   
    
    get formDepartment() {
        return this.formData?.formDepartment || 'No department specified';
    }
    
    get questions() {
        return this.formData?.questions || [];
    }
    
    get hasFilteredUsers() {
        return this.filteredUserResponses?.length > 0;
    }

    get showBranchFilters() {
        return this.isCBO && this.userPermissions.canViewBranchFilters;
    }

    get accessLevelLabel() {
        if (this.userPermissions.canViewAllDepartments) {
            return 'Executive Access - All Users';
        } else {
            return 'Department Access - Team & Self';
        }
    }
    
    get statusCounts() {
        if (!this.formData?.userResponses) {
            return { total: 0, submitted: 0, pending: 0, reviewed: 0 };
        }
        
        const users = this.formData.userResponses;
        return {
            total: users.length,
            submitted: users.filter(u => u.hasSubmitted).length,
            pending: users.filter(u => !u.hasSubmitted).length,
            reviewed: users.filter(u => u.hasManagerResponse).length
        };
    }
    
    get RegionFilterOptions() {
        return this.RegionOptions;
    }
    
    get ClusterFilterOptions() {
        return this.ClusterOptions;
    }
    
    get branchFilterOptions() {
        return this.branchOptions;
    }
}