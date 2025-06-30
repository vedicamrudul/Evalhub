import { LightningElement, wire, track } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import getAllUserResponsesForAdmin from '@salesforce/apex/QuestionsController.getAllUserResponsesForAdmin';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadScript } from 'lightning/platformResourceLoader';
import ChartJS from '@salesforce/resourceUrl/ChartJS';

export default class ViewResponsesPage extends NavigationMixin(LightningElement) {
    @track isLoading = false;
    @track formData;
    @track error;
    @track searchTerm = '';
    @track viewOption = 'all'; // all, submitted, pending, reviewed
    @track showAnalytics = false;
    @track analyticsData;
    @track chartJsInitialized = false;
    
    // Options for the view filter
    viewOptions = [
        { label: 'All', value: 'all' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Pending', value: 'pending' },
        { label: 'Reviewed', value: 'reviewed' }
    ];

    // Wire the page reference to get URL parameters
    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        if (pageRef) {
            console.log('Page Reference received:', JSON.stringify(pageRef));
            console.log('State parameters:', JSON.stringify(pageRef.state));
            
            // Get form ID from URL parameters - we now know we're using c__formId
            this.formId = pageRef.state?.c__formId;
            
            console.log('FormId extracted:', this.formId);
            
            if (this.formId) {
                this.loadUserResponses();
            } else {
                this.error = 'No form selected. Please select a form from the previous page.';
                console.error('No form ID found in URL parameters');
            }
        }
    }
    
    // Load user responses from server
    loadUserResponses() {
        if (!this.formId) {
            this.error = 'No form selected. Please select a form from the previous page.';
            return;
        }
        
        console.log('Loading user responses for formId:', this.formId);
        this.isLoading = true;
        this.error = null;
        
        getAllUserResponsesForAdmin({ formId: this.formId })
            .then(result => {
                console.log('User responses received:', JSON.stringify(result));
                this.formData = result;
                this.analyticsData = result.analytics || {};
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
    
    // Process user responses data to add computed properties
    processUserResponsesData() {
        if (!this.formData?.userResponses) return;
        
        // Create a deep clone to ensure objects are extensible
        this.formData = JSON.parse(JSON.stringify(this.formData));
        
        // Create a map of questions for reference
        const questionMap = {};
        if (this.formData.questions) {
            this.formData.questions.forEach(question => {
                questionMap[question.id] = question;
            });
        }
        
        // Process each user's responses
        this.formData.userResponses.forEach(user => {
            // Create a response map for easy lookup
            const responseMap = {};
            if (user.questionResponses) {
                user.questionResponses.forEach(response => {
                    response.isAnswered = !!response.answer && response.answer.trim() !== '';
                    if (response.questionId) {
                        responseMap[response.questionId] = response;
                    }
                });
            }
            
            // Store the response map on the user object
            user._responseMap = responseMap;
            
            // Pre-format answers for all questions in order
            user.formattedAnswers = [];
            if (this.formData.questions) {
                this.formData.questions.forEach(question => {
                    const response = responseMap[question.id];
                    user.formattedAnswers.push({
                        questionId: question.id,
                        text: response?.isAnswered ? response.answer : 'No answer provided',
                        isAnswered: response?.isAnswered || false
                    });
                });
            }
        });
    }
    
    // Apply filters based on search term and selected view
    applyFilters() {
        if (!this.formData?.userResponses) {
            this.filteredUserResponses = [];
            return;
        }
        
        const searchLower = this.searchTerm?.toLowerCase() || '';
        
        this.filteredUserResponses = this.formData.userResponses.filter(user => {
            // Apply search filter
            if (searchLower) {
                const matchesSearch = 
                    user.userName?.toLowerCase().includes(searchLower) ||
                    user.department?.toLowerCase().includes(searchLower) ||
                    user.role?.toLowerCase().includes(searchLower);
                
                if (!matchesSearch) return false;
            }
            
            // Apply view filter
            switch (this.viewOption) {
                case 'submitted':
                    return user.hasSubmitted;
                case 'pending':
                    return !user.hasSubmitted;
                case 'reviewed':
                    return user.hasManagerResponse;
                default: // 'all'
                    return true;
            }
        });
    }
    
    // Handle search input
    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        this.applyFilters();
    }
    
    // Handle view option change
    handleViewOptionChange(event) {
        this.viewOption = event.detail.value;
        this.applyFilters();
    }
    
    // Analytics quick filters
    handleShowAll() {
        this.viewOption = 'all';
        this.searchTerm = '';
        this.applyFilters();
    }
    
    handleShowSubmitted() {
        this.viewOption = 'submitted';
        this.applyFilters();
    }
    
    handleShowPending() {
        this.viewOption = 'pending';
        this.applyFilters();
    }
    
    handleShowReviewed() {
        this.viewOption = 'reviewed';
        this.applyFilters();
    }
    
    // Clear error message
    clearError() {
        this.error = null;
    }
    
    // Navigate back to the previous forms page
    navigateBack() {
        this[NavigationMixin.Navigate]({
            type: 'standard__navItemPage',
            attributes: {
                apiName: 'View_Previous_Forms'
            }
        });
    }
    
    // Refresh the data
    refreshData() {
        this.loadUserResponses();
    }
    
    // Toggle analytics visibility
    toggleAnalytics() {
        this.showAnalytics = !this.showAnalytics;
        
        if (this.showAnalytics && !this.chartJsInitialized) {
            this.initializeChartJs();
        } else if (this.showAnalytics && this.chartJsInitialized) {
            // Re-render charts after toggle
            setTimeout(() => {
                this.renderCharts();
            }, 100);
        }
    }
    
    // Initialize Chart.js library
    async initializeChartJs() {
        try {
            console.log('Loading Chart.js from static resource...');
            await loadScript(this, ChartJS);
            console.log('Chart.js loaded successfully');
            this.chartJsInitialized = true;
            
            // Small delay to ensure Chart is available globally
            setTimeout(() => {
                if (typeof Chart !== 'undefined') {
                    console.log('Chart.js is available, rendering charts...');
                    this.renderCharts();
                } else {
                    console.error('Chart.js not available after loading');
                    this.showToast('Error', 'Chart library not available', 'error');
                }
            }, 200);
        } catch (error) {
            console.error('Error loading Chart.js:', error);
            this.showToast('Error', 'Failed to load charting library: ' + error.message, 'error');
            this.chartJsInitialized = false;
        }
    }
    
    // Render all charts
    renderCharts() {
        if (!this.chartJsInitialized) {
            console.log('Chart.js not initialized yet');
            return;
        }
        
        if (!this.analyticsData) {
            console.log('No analytics data available');
            return;
        }
        
        if (typeof Chart === 'undefined') {
            console.error('Chart is not defined globally');
            this.showToast('Error', 'Chart library not loaded properly', 'error');
            return;
        }
        
        console.log('Starting to render charts with data:', this.analyticsData);
        
        setTimeout(() => {
            try {
                this.renderPieChart('responseStatusChart', this.analyticsData.responseStatusBreakdown, 'Response Status Distribution');
                this.renderPieChart('userStatusChart', this.analyticsData.userStatusBreakdown, 'User Status Distribution');
                this.renderPieChart('managerFeedbackChart', this.analyticsData.managerFeedbackBreakdown, 'Manager Feedback Status');
                this.renderBarChart('departmentChart', this.analyticsData.departmentBreakdown, 'Users by Department');
                this.renderBarChart('roleChart', this.analyticsData.roleBreakdown, 'Users by Role');
                this.renderBarChart('questionResponseChart', this.analyticsData.questionResponseRates, 'Question Response Rates');
                console.log('All charts rendered successfully');
            } catch (error) {
                console.error('Error rendering charts:', error);
                this.showToast('Error', 'Failed to render charts: ' + error.message, 'error');
            }
        }, 300);
    }
    
    // Render pie chart
    renderPieChart(canvasId, data, title) {
        console.log(`Rendering pie chart: ${canvasId}`, data);
        
        const canvas = this.template.querySelector(`[data-id="${canvasId}"]`);
        if (!canvas) {
            console.error(`Canvas not found for ${canvasId}`);
            return;
        }
        
        if (!data || data.length === 0) {
            console.log(`No data for chart ${canvasId}`);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error(`Could not get 2D context for ${canvasId}`);
            return;
        }
        
        // Destroy existing chart if it exists
        if (canvas.chart) {
            canvas.chart.destroy();
        }
        
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
        ];
        
        try {
            console.log(`Creating Chart.js pie chart for ${canvasId}`);
            canvas.chart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: data.map(item => item.label),
                    datasets: [{
                        data: data.map(item => item.value),
                        backgroundColor: colors.slice(0, data.length),
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: title
                        },
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
            console.log(`Successfully created pie chart for ${canvasId}`);
        } catch (error) {
            console.error(`Error creating pie chart for ${canvasId}:`, error);
        }
    }
    
    // Render bar chart
    renderBarChart(canvasId, data, title) {
        console.log(`Rendering bar chart: ${canvasId}`, data);
        
        const canvas = this.template.querySelector(`[data-id="${canvasId}"]`);
        if (!canvas) {
            console.error(`Canvas not found for ${canvasId}`);
            return;
        }
        
        if (!data || data.length === 0) {
            console.log(`No data for chart ${canvasId}`);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error(`Could not get 2D context for ${canvasId}`);
            return;
        }
        
        // Destroy existing chart if it exists
        if (canvas.chart) {
            canvas.chart.destroy();
        }
        
        let chartData, labels;
        
        if (canvasId === 'questionResponseChart') {
            // Special handling for question response rates
            labels = data.map(item => item.questionText);
            chartData = data.map(item => item.responseRate);
        } else {
            labels = data.map(item => item.label);
            chartData = data.map(item => item.value);
        }
        
        try {
            console.log(`Creating Chart.js bar chart for ${canvasId}`);
            canvas.chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: canvasId === 'questionResponseChart' ? 'Response Rate (%)' : 'Count',
                        data: chartData,
                        backgroundColor: '#36A2EB',
                        borderColor: '#1E88E5',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: title
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: canvasId === 'questionResponseChart' ? 100 : undefined
                        },
                        x: {
                            ticks: {
                                maxRotation: 45
                            }
                        }
                    }
                }
            });
            console.log(`Successfully created bar chart for ${canvasId}`);
        } catch (error) {
            console.error(`Error creating bar chart for ${canvasId}:`, error);
        }
    }
    
    // Helper method to show toast notifications
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title,
            message,
            variant
        }));
    }
    
    // Helper method to reduce errors to user-friendly messages
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
    
    // Getters for template
    get hasFormData() {
        return this.formData?.userResponses;
    }
    
    get formName() {
        return this.formData?.formName || 'Untitled Form';
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
    
    get hasAnalyticsData() {
        return this.analyticsData && Object.keys(this.analyticsData).length > 0;
    }
    
    get analyticsButtonLabel() {
        return this.showAnalytics ? 'Hide Analytics' : 'Show Analytics';
    }
    
    get analyticsButtonIcon() {
        return this.showAnalytics ? 'utility:chevronup' : 'utility:analytics';
    }
    
    get analyticsButtonVariant() {
        return this.showAnalytics ? 'brand' : 'neutral';
    }
}