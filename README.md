# EvalHub - Employee Feedback Management System

![Salesforce](https://img.shields.io/badge/Salesforce-Lightning%20Web%20Components-00a1e0)
![Apex](https://img.shields.io/badge/Apex-Backend-1589f0)
![API](https://img.shields.io/badge/API%20Version-64.0-orange)

**EvalHub** is a comprehensive Salesforce-based employee feedback management system designed for monthly departmental feedback collection, review, and management across organizational hierarchies.

## 🚀 Quick Start

### Prerequisites
- Salesforce CLI installed
- VS Code with Salesforce Extensions
- Access to a Salesforce org (Dev/Sandbox/Production)
- Node.js (for LWC development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd EvalHub
   ```

2. **Authenticate with your Salesforce org**
   ```bash
   sf org login web --set-default --alias evalhub-org
   ```

3. **Deploy to your org**
   ```bash
   sf project deploy start --source-dir force-app/main/default
   ```

4. **Assign Permission Sets**
   ```bash
   sf org assign permset --name "Executive_Permission_Set"
   ```

5. **Set up Custom Metadata Types**
   - Deploy the `Input_Scale_Config__mdt` records for question types
   - Configure rating scales, emoji options, and picklist values

## 📋 System Overview

EvalHub streamlines the employee feedback process through:

- **📝 Dynamic Form Creation** - Admins create customizable monthly feedback forms
- **⚡ Automated Activation** - Forms auto-activate monthly via scheduled jobs  
- **👥 Role-Based Access** - Employees, managers, and admins have tailored interfaces
- **📊 Real-time Analytics** - Comprehensive reporting and response tracking
- **📧 Email Notifications** - Automated notifications for submissions and responses

### Core Features

| Feature | Description | Users |
|---------|-------------|-------|
| Form Builder | Dynamic form creation with multiple question types | Admins |
| Response Collection | Submit feedback with various input types (text, rating, emoji, slider) | Employees |
| Manager Dashboard | Review team responses and provide feedback | Managers |
| Analytics & Reporting | View responses, generate reports, track completion | Admins |
| Automated Workflows | Monthly form activation and email notifications | System |

## 🏗️ Architecture

### Lightning Web Components

| Component | Purpose | User Role |
|-----------|---------|-----------|
| `createForm` | Dynamic form builder interface | Admin |
| `viewAllPreviousForms` | Form management dashboard | Admin |
| `viewAllResponsesForGivenForm` | Comprehensive reporting | Admin |
| `viewJuniorResponseAndGiveFeedback` | Team management dashboard | Manager |
| `yourQuestionAnswerComp` | Feedback submission and viewing | Employee |

### Apex Controllers

| Controller | Responsibility |
|------------|----------------|
| `FormController` | Form and question management |
| `QuestionsController` | Core feedback operations |
| `UserController` | User hierarchy management |
| `EmailController` | Notification system |
| `MonthlyFormActivatior` | Scheduled automation |

### Data Model

| Object | Purpose |
|--------|---------|
| `Feedback_Form__c` | Monthly feedback forms |
| `Feedback_Question__c` | Individual questions |
| `Feedback_Response__c` | Employee responses |
| `Manager_Response__c` | Manager feedback |
| `Input_Scale_Config__mdt` | Question type configurations |

## 🔧 Development Guide

### Project Structure
```
force-app/main/default/
├── classes/           # Apex controllers
├── lwc/              # Lightning Web Components
├── objects/          # Custom objects and fields
├── permissionsets/   # Permission sets
├── applications/     # Lightning apps
└── triggers/         # Apex triggers (if any)
```

### Running Tests
```bash
# Run all tests
sf apex run test --code-coverage --result-format human

# Run specific test class
sf apex run test --tests YourTestClass --result-format human
```

### LWC Development
```bash
# Create new component
sf lightning generate component myComponent --type lwc

# Run Jest tests
npm test

# Debug in VS Code
Use Lightning Web Components extension for debugging
```

### Code Quality
- Follow Salesforce coding standards
- Maintain test coverage above 75%
- Use descriptive naming conventions
- Document complex business logic

## 📖 Usage Guide

### For Administrators

1. **Create Monthly Forms**
   - Navigate to the EvalHub app
   - Use the Create Form component
   - Add questions with various input types
   - Set department and applicable month

2. **Monitor Responses**
   - View all responses dashboard
   - Filter by department, status, or month
   - Export data for analysis

### For Managers

1. **Review Team Responses**
   - Access your team dashboard
   - View employee submissions
   - Provide written feedback
   - Track completion rates

### For Employees

1. **Submit Feedback**
   - Complete monthly feedback forms
   - View your submission history
   - Check manager feedback

## ⚙️ Configuration

### Question Types Supported

| Type | Description | Example Use Case |
|------|-------------|------------------|
| Text | Free text input | "What are your goals for next month?" |
| Rating | 1-5 star rating | "Rate your job satisfaction" |
| Emoji | Emoji-based scale | "How do you feel about the workload?" |
| Slider | Numeric scale (1-10) | "Rate team collaboration" |
| Picklist | Dropdown options | "What's your preferred work style?" |

### Custom Metadata Configuration

Configure question types in `Input_Scale_Config__mdt`:
- Set display labels and stored values
- Define scale groups and ordering
- Enable/disable specific configurations

## 🔒 Security & Permissions

### Profiles Required
- **Executive Profile** - Employee access
- **Manager Profile** - Manager access  
- **System Administrator** - Full access

### Key Security Features
- Role-based data access
- Department-based filtering
- Manager-subordinate relationships
- Field-level security

## 🚀 Deployment

### Sandbox Deployment
```bash
sf project deploy start --source-dir force-app/main/default --target-org sandbox-alias
```

### Production Deployment
```bash
# Validate first
sf project deploy validate --source-dir force-app/main/default --target-org production-alias

# Deploy after validation
sf project deploy start --source-dir force-app/main/default --target-org production-alias
```

### Post-Deployment Steps
1. Assign permission sets to users
2. Configure custom metadata types
3. Set up scheduled jobs for monthly activation
4. Test email notification functionality

## 📚 Documentation

- **[System Architecture](./EvalHub_System_Architecture_Documentation.md)** - Detailed technical architecture
- **[System Documentation](./EVALHUB_SYSTEM_DOCUMENTATION.md)** - Complete system documentation
- **[Project Configuration](./sfdx-project.json)** - Salesforce DX project settings

## 🧪 Testing

The system includes comprehensive test coverage:
- Apex test classes for all controllers
- Jest tests for LWC components
- Integration tests for end-to-end workflows

Run tests before deployment:
```bash
npm run test:unit:coverage
sf apex run test --code-coverage --result-format human
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update tests
5. Submit a pull request

### Development Workflow
1. Create scratch org: `sf org create scratch --definition-file config/project-scratch-def.json`
2. Push source: `sf project deploy start`
3. Test changes
4. Create pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
- Check the [System Architecture Documentation](./EvalHub_System_Architecture_Documentation.md)
- Review existing GitHub issues
- Contact the development team

---

**EvalHub** - Streamlining employee feedback management with modern Salesforce technology.
