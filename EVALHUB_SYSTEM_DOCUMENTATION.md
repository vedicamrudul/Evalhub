# EvalHub - Employee Feedback Management System

## 📋 Project Overview

**EvalHub** is a Salesforce-based employee feedback management system designed to facilitate monthly departmental feedback collection, review, and management. The system supports three primary user roles: **Executives (Employees)**, **Managers**, and **System Administrators**.

### Core Purpose
- Monthly feedback form creation and distribution
- Employee self-assessment and feedback submission
- Manager review and response to employee feedback
- Administrative oversight and reporting across all departments

---

## 🏗️ System Architecture

### Platform: Salesforce DX Project
- **API Version**: 64.0
- **Framework**: Lightning Web Components (LWC) + Apex Controllers
- **Authentication**: Salesforce Security Model with Custom Profiles and Permission Sets

### Custom Profiles Created:
1. **Executive Profile** - For employees submitting feedback
2. **Manager Profile** - For managers reviewing and responding to employee feedback
3. **System Administrator** - Default admin access

### Permission Sets:
- **Executive Permission Set** - Grants access to custom objects and Apex classes for executives

---

## 👥 User Roles & Workflows

### 1. **System Administrator**
- **Creates monthly feedback forms** with custom questions
- **Manages form activation/deactivation** through scheduled processes
- **Views all user responses** across departments
- **Monitors system-wide feedback completion rates**

**Key Components:**
- `createForm` LWC for form creation
- `viewPreviousFormAdmin` LWC for form management
- `viewResponsesPage` LWC for comprehensive reporting

### 2. **Manager**
- **Views all direct subordinates** in their department
- **Reviews employee feedback responses** for their team
- **Submits manager responses** to employee feedback
- **Tracks team feedback completion status**

**Key Components:**
- `viewAllExecutiveUnderManager` LWC for team management
- `viewResponseForExecutive` LWC for individual employee review

### 3. **Executive (Employee)**
- **Submits monthly feedback** on active departmental forms
- **Views their submitted responses** after completion
- **Reads manager feedback** once provided
- **Access to department-specific active forms only**

**Key Components:**
- `employeeQuestionAnswer` LWC for feedback submission and viewing

---

## 🗃️ Data Model (Custom Objects)

### 1. **Feedback_Form__c**
Monthly feedback forms created by administrators.

**Key Fields:**
- `Title__c` (Text) - Auto-generated title (e.g., "Sales Feedback January 2025")
- `department__c` (Picklist) - Sales, Marketing, Technical
- `Active_Flag__c` (Checkbox) - Controls form availability
- `Applicable_Month__c` (Date) - Target month for feedback

**Business Logic:**
- Only ONE active form per department at any time
- Auto-activation through scheduled Apex class
- Forms are department-specific

### 2. **Feedback_Question__c**
Individual questions within feedback forms.

**Key Fields:**
- `Feedback_Form__c` (Lookup) - Parent form relationship
- `Question_Text__c` (Long Text Area) - The actual question
- `Input_Type__c` (Picklist) - Text, Picklist, Rating/Number
- `Picklist_Values__c` (Text) - Comma/semicolon separated values for picklist questions

**Question Types Supported:**
- **Text Input** - Free text responses
- **Rating/Number** - Numeric scale responses
- **Picklist** - Pre-defined dropdown options

### 3. **Feedback_Response__c**
Employee responses to feedback questions.

**Key Fields:**
- `Question_Lookup__c` (Lookup) - Links to specific question
- `Rating_Answer__c` (Text) - Stores the response value
- `Responder__c` (Lookup to User) - Who submitted the response
- `Respondent__c` (Lookup to User) - Who the response is about (same as Responder for self-feedback)

**Data Integrity:**
- Prevents duplicate responses per user per question
- Stores responses as text to accommodate all input types

### 4. **Manager_Response__c**
Manager feedback to employee submissions.

**Key Fields:**
- `Feedback_Form_Lookup__c` (Lookup) - Links to the feedback form
- `User_Lookup__c` (Lookup to User) - The employee being reviewed
- `Manager_Response_Test__c` (Long Text Area 500 chars) - Manager's written feedback

**Business Rules:**
- One manager response per employee per form
- Manager can only respond to their direct subordinates
- Responses tied to specific form cycles

---

## ⚙️ Apex Controllers

### 1. **FormController.cls**
Handles all form-related operations for administrators.

**Key Methods:**
```apex
@AuraEnabled
public static String createForm(FeedbackFormWrapper, List<FeedbackQuestionWrapper>)
```
- Creates feedback form with associated questions
- Validates for duplicate forms per department/month
- Returns form ID for frontend confirmation

```apex
@AuraEnabled(cacheable=true)
public static List<Feedback_Form__c> getAllForms()
```
- Retrieves all forms from last 12 months
- Used in admin view for form management

```apex
@AuraEnabled(cacheable=true)
public static List<Feedback_Form__c> getFilteredForms(String department, Integer month, Integer year)
```
- Advanced filtering for admin form search
- Dynamic SOQL query with parameter binding

```apex
@AuraEnabled(cacheable=true)
public static List<Feedback_question__c> getQuestions(Id formId)
```
- Retrieves all questions for a specific form
- Used across multiple components for form display

### 2. **QuestionsController.cls**
Core business logic for feedback submission and retrieval.

**Key Methods:**
```apex
@AuraEnabled(cacheable=true)
public static Map<String, Object> getFeedbackData()
```
- Gets active form questions for current user's department
- Returns user's existing responses if already submitted
- Includes manager response text if available
- Primary method for employee feedback interface

```apex
@AuraEnabled
public static String submitFeedback(List<QuestionAnswerPair> answers, Id respondentId)
```
- Processes employee feedback submission
- Bulk inserts all responses in single DML operation
- Validates required fields and user permissions

```apex
@AuraEnabled(cacheable=true)
public static Map<String, Object> getEmployeeResponseForManager(Id employeeId)
```
- Retrieves employee responses for manager review
- Returns questions, employee answers, and manager response status
- Used by managers to review individual employee feedback

```apex
@AuraEnabled
public static String submitManagerResponse(ManagerResponse response)
```
- Processes manager feedback submission
- Validates manager has authority over the employee
- Creates Manager_Response__c record

```apex
@AuraEnabled(cacheable=true)
public static Map<String, Object> getAllUserResponsesForAdmin(Id formId)
```
- Comprehensive admin view of all responses for a form
- Returns all users, their responses, and manager feedback
- Used for system-wide reporting

### 3. **UserController.cls**
User management and hierarchy operations.

**Key Methods:**
```apex
@AuraEnabled(cacheable=true)
public static User getCurrentUser()
```
- Returns current user with profile, department, and manager info
- Used across all components for authentication context

```apex
@AuraEnabled(cacheable=true)
public static List<User> getUsersUnderCurrentUser()
```
- Returns DIRECT subordinates based on role hierarchy
- Used by managers to see their team members

```apex
@AuraEnabled(cacheable=true)
public static List<User> getAllUsers()
```
- Returns all users except system admins
- Filtered by department for admin views
- Used in comprehensive admin reporting

### 4. **MonthlyFormActivatior.cls** (Schedulable)
Automated form lifecycle management.

**Functionality:**
- **Scheduled monthly execution** (1st of each month at midnight)
- **Activates current month forms** for each department
- **Deactivates previous month forms** automatically
- **Ensures only one active form per department**

**Scheduling:**
```apex
String cronExp = '0 0 0 1 * ?'; // Midnight on 1st of every month
System.schedule('Monthly Form Activator', cronExp, new MonthlyFormActivator());
```

---

## 🖥️ Lightning Web Components (LWC)

### Admin Components

#### 1. **createForm**
**Purpose:** Form creation interface for administrators

**Features:**
- **Dynamic form building** with add/remove questions
- **Auto-title generation** based on department and month
- **Multiple question types** (Text, Rating, Picklist)
- **Real-time validation** and error handling
- **Prevention of duplicate forms** per department/month

**Key Technical Details:**
- Uses `@track` for reactive form state
- Implements custom validation logic
- Handles complex form submission with nested objects

#### 2. **viewPreviousFormAdmin**
**Purpose:** Admin interface for managing existing forms

**Features:**
- **Advanced filtering** by department, month, year
- **Form questions toggle view** with lazy loading
- **Navigation to response viewing** 
- **Comprehensive form metadata display**

**Technical Implementation:**
- NavigationMixin for inter-component routing
- Dynamic SOQL query execution
- Efficient data caching and state management

#### 3. **viewResponsesPage**
**Purpose:** Comprehensive admin reporting dashboard

**Features:**
- **All user responses** for selected form
- **Manager feedback viewing**
- **Export capabilities** for reporting
- **Department-wise filtering**

### Manager Components

#### 4. **viewAllExecutiveUnderManager**
**Purpose:** Manager's team oversight dashboard

**Features:**
- **Direct subordinate listing** based on role hierarchy
- **Individual employee response viewing**
- **Manager feedback submission interface**
- **Team completion status tracking**

**Technical Highlights:**
- Complex state management for multiple users
- Dynamic response loading and caching
- Inline editing capabilities for manager responses

#### 5. **viewResponseForExecutive**
**Purpose:** Detailed individual employee review

**Features:**
- **Complete employee response viewing**
- **Manager response submission**
- **Response comparison tools**
- **Historical feedback tracking**

### Employee Components

#### 6. **employeeQuestionAnswer**
**Purpose:** Employee feedback submission and viewing

**Features:**
- **Active form detection** based on user department
- **Dynamic question rendering** based on input type
- **Response submission with validation**
- **Submitted response viewing mode**
- **Manager feedback display**

**Technical Features:**
- Reactive form state management
- Custom validation per question type
- Toggle between submission and viewing modes
- Real-time feedback status updates

#### 7. **customResponseTable**
**Purpose:** Tabular response display component

**Features:**
- **Reusable table component** for response display
- **Sortable columns**
- **Responsive design**
- **Export functionality**

---

## 🚀 Deployment & Setup

### Prerequisites
1. **Salesforce DX CLI** installed
2. **Connected Salesforce org** (Developer/Production)
3. **Custom profiles created** (Executive, Manager)
4. **Permission set assignments** completed

### Setup Steps

#### 1. **Deploy Metadata:**
```bash
sfdx force:source:deploy -p force-app/main/default -u your-org-alias
```

#### 2. **Create Custom Profiles:**
- Navigate to Setup → Profiles
- Clone Standard User profile → Rename to "Executive"
- Clone Standard User profile → Rename to "Manager"
- Enable Lightning Experience for both profiles

#### 3. **Configure Permission Sets:**
- Create "Executive Permission Set"
- Add access to:
  - Custom Objects (Feedback_Form__c, Feedback_Question__c, etc.)
  - Apex Classes (FormController, QuestionsController, UserController)
  - Lightning Apps

#### 4. **Schedule Monthly Activator:**
```apex
// Execute in Developer Console
String cronExp = '0 0 0 1 * ?';
System.schedule('Monthly Form Activator', cronExp, new MonthlyFormActivatior());
```

#### 5. **Configure User Hierarchy:**
- Assign users to appropriate roles
- Set Manager relationships
- Assign custom profiles to users

#### 6. **Create Lightning Apps:**
- Admin App: Include all admin components
- Manager App: Include manager-specific components  
- Employee App: Include employee components

### Development Environment
```bash
# Install dependencies
npm install

# Run tests
npm run test:unit

# Format code
npm run prettier

# Lint code
npm run lint
```

---

## ✨ Key Features & Business Logic

### 1. **Automated Form Lifecycle**
- **Monthly activation** of department-specific forms
- **Automatic deactivation** of previous month forms
- **Prevention of multiple active forms** per department

### 2. **Role-Based Access Control**
- **Department-based form access** for employees
- **Hierarchical team access** for managers
- **System-wide access** for administrators

### 3. **Data Integrity & Validation**
- **Duplicate prevention** for responses
- **Required field validation** across all forms
- **User permission validation** before data operations

### 4. **Flexible Question Types**
- **Text responses** for open-ended feedback
- **Numeric ratings** for quantitative assessment
- **Picklist options** for standardized responses

### 5. **Manager-Employee Interaction**
- **Two-way feedback system** (employee → manager → employee)
- **Manager response tracking** and completion status
- **Historical feedback viewing** capabilities

### 6. **Administrative Oversight**
- **Cross-departmental reporting** capabilities
- **Form management** and question modification
- **User response analytics** and completion tracking

---

## 🔧 Technical Implementation Details

### Error Handling Strategy
```apex
try {
    // DML operations
    insert records;
} catch (DmlException e) {
    throw new AuraHandledException('User-friendly error: ' + e.getMessage());
}
```

### Security Implementation
- **With sharing** classes for data security
- **Field-level security** respect in SOQL queries
- **User permission validation** before operations

### Performance Optimizations
- **Cacheable Apex methods** for read operations
- **Bulk DML operations** for data manipulation
- **Lazy loading** in Lightning components
- **Efficient SOQL queries** with selective fields

### Data Access Patterns
```apex
// Efficient query with relationship fields
List<Feedback_Response__c> responses = [
    SELECT Id, Rating_Answer__c, Question_Lookup__r.Question_Text__c,
           Responder__r.Name, Respondent__r.Department
    FROM Feedback_Response__c 
    WHERE Question_Lookup__c IN :questionIds
    LIMIT 1000
];
```

---

## 📈 Current Status & Future Roadmap

### ✅ **Completed Features (as of June 2025)**
- Basic form creation and management
- Employee feedback submission
- Manager review and response system
- Administrative oversight capabilities
- Role-based access control
- Automated form activation

### 🚧 **Known Issues & Technical Debt**
1. **Limited Lightning Experience access** for Executive profile (resolved)
2. **Permission set dependency** for Apex class access
3. **Manual scheduling** required for MonthlyFormActivatior
4. **Hard-coded department values** in picklists

### 🔮 **Future Enhancements**
1. **Advanced Analytics Dashboard**
   - Trend analysis across months
   - Department performance comparisons
   - Feedback sentiment analysis

2. **Notification System**
   - Email alerts for form activation
   - Reminder notifications for pending submissions
   - Manager alerts for team completion status

3. **Mobile Optimization**
   - Responsive design improvements
   - Mobile-specific component variants
   - Offline capability for form submission

4. **Integration Capabilities**
   - External HR system integration
   - Data export to BI tools
   - API endpoints for external access

5. **Enhanced Question Types**
   - Multi-select options
   - File upload capabilities
   - Matrix/grid questions
   - Conditional question logic

6. **Advanced Reporting**
   - Custom report builder
   - Scheduled report generation
   - Data visualization components
   - Export to various formats

---

## 📚 Development Notes

### Code Organization
```
force-app/main/default/
├── classes/                 # Apex Controllers
│   ├── FormController.cls
│   ├── QuestionsController.cls
│   ├── UserController.cls
│   └── MonthlyFormActivatior.cls
├── lwc/                     # Lightning Web Components
│   ├── createForm/
│   ├── employeeQuestionAnswer/
│   ├── viewAllExecutiveUnderManager/
│   └── viewPreviousFormAdmin/
├── objects/                 # Custom Objects (empty in current structure)
├── permissionsets/          # Permission Sets
├── triggers/                # Database Triggers (if any)
└── applications/            # Lightning Apps
```

### Testing Strategy
- **Apex Unit Tests** for all controller methods
- **LWC Jest Tests** for component logic
- **Integration testing** for complete workflows
- **User acceptance testing** for each role

### Version Control & CI/CD
- **Git-based** source control
- **Salesforce DX** project structure
- **Automated deployment** capabilities
- **Code quality** enforcement through ESLint and Prettier

---

## 🤝 Contributing Guidelines

### Code Standards
- **Apex**: Follow Salesforce coding conventions
- **LWC**: Use ESLint configuration provided
- **Documentation**: Update this README for major changes
- **Testing**: Maintain >85% code coverage

### Development Workflow
1. Create feature branch from main
2. Implement changes with tests
3. Run quality checks (lint, prettier, tests)
4. Create pull request with description
5. Code review and approval
6. Deploy to staging environment
7. User acceptance testing
8. Production deployment

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Developer:** Vedica Mrudul
**Project:** EvalHub Employee Feedback Management System 