public with sharing class EmailController {
    
    @AuraEnabled
    public static String sendEmailOnFeedbackSubmit(){
        try {
            User user = [SELECT Id, UserRoleId, Email, Name FROM User WHERE Id = :UserInfo.getUserId()];
            
            String orgUrl = 'https://homefirstfinance4-dev-ed.develop.lightning.force.com/lightning/n/Employee_Q_and_A';
            
            sendEmployeeEmail(user, orgUrl);
            
            String mangerOrgUrl = 'https://homefirstfinance4-dev-ed.develop.lightning.force.com/lightning/n/Manager_View';
            String managerResult = sendManagerEmail(user, mangerOrgUrl);
            return 'Email sent to: ' + user.Name + ' (' + user.Email + ')' + managerResult;
            
        } catch (Exception e) {
            return 'Error sending emails: ' + e.getMessage();
        }
    }
    
    // New method to send emails to all department employees when a form is created
    public static void sendFormCreationNotification(List<Feedback_Form__c> newForms) {
        try {
            // Group forms by department
            Map<String, List<Feedback_Form__c>> formsByDepartment = new Map<String, List<Feedback_Form__c>>();
            
            for (Feedback_Form__c form : newForms) {
                if (String.isNotBlank(form.department__c)) {
                    if (!formsByDepartment.containsKey(form.department__c)) {
                        formsByDepartment.put(form.department__c, new List<Feedback_Form__c>());
                    }
                    formsByDepartment.get(form.department__c).add(form);
                }
            }
            
            // Get all users for each department
            List<User> departmentUsers = [
                SELECT Id, Name, Email, department__c 
                FROM User 
                WHERE department__c IN :formsByDepartment.keySet()
                AND IsActive = true
                AND Email != null
                AND Profile.Name != 'System Administrator'
            ];
            
            // Group users by department
            Map<String, List<User>> usersByDepartment = new Map<String, List<User>>();
            for (User user : departmentUsers) {
                if (!usersByDepartment.containsKey(user.department__c)) {
                    usersByDepartment.put(user.department__c, new List<User>());
                }
                usersByDepartment.get(user.department__c).add(user);
            }
            
            // Send emails for each department that has new forms
            List<Messaging.SingleEmailMessage> emailsToSend = new List<Messaging.SingleEmailMessage>();
            
            for (String department : formsByDepartment.keySet()) {
                List<Feedback_Form__c> deptForms = formsByDepartment.get(department);
                List<User> deptUsers = usersByDepartment.get(department);
                
                if (deptUsers != null && !deptUsers.isEmpty()) {
                    for (Feedback_Form__c form : deptForms) {
                        for (User user : deptUsers) {
                            Messaging.SingleEmailMessage email = createFormNotificationEmail(user, form);
                            emailsToSend.add(email);
                        }
                    }
                }
            }
            
            // Send all emails in batch
            if (!emailsToSend.isEmpty()) {
                Messaging.sendEmail(emailsToSend);
            }
            
        } catch (Exception e) {
            System.debug('Error sending form creation emails: ' + e.getMessage());
        }
    }
    
    private static Messaging.SingleEmailMessage createFormNotificationEmail(User user, Feedback_Form__c form) {
        String orgUrl = 'https://homefirstfinance4-dev-ed.develop.lightning.force.com/lightning/n/Employee_Q_and_A';
        
        String subject = 'New Feedback Form Available - ' + form.Title__c;
        
        String body = 'Dear ' + user.Name + ',\n\n' +
            'A new feedback form has been created for your department and is now available for completion.\n\n' +
            'FORM DETAILS:\n' +
            '• Form Title: ' + form.Title__c + '\n' +
            '• Department: ' + form.department__c + '\n' +
            '• Applicable Month: ' + (form.Applicable_Month__c != null ? form.Applicable_Month__c.format() : 'Not specified') + '\n' +
            '• Status: ' + (form.Active_Flag__c ? 'Active - Ready to Complete' : 'Available Soon') + '\n\n' +
            'ACTION REQUIRED:\n' +
            '• Complete your feedback form: ' + orgUrl + '\n' +
            '• Please submit your responses by the end of the month\n' +
            '• Your feedback is important for continuous improvement\n\n' +
            'If you have any questions about the feedback process, please contact your manager or system administrator.\n\n' +
            'Thank you for your participation!\n\n' +
            'Best regards,\n' +
            'EvalHub System\n' +
            'Automated Email - Please do not reply';
        
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(new List<String>{user.Email});
        email.setSubject(subject);
        email.setPlainTextBody(body);
        
        return email;
    }
    
    private static void sendEmployeeEmail(User user, String orgUrl) {
        String subject = 'Feedback Submitted Successfully - Action Required';
        
        String body = 'Dear ' + user.Name + ',\n\n' +
            'Thank you for taking the time to submit your feedback! Your response has been successfully recorded in our evaluation system.\n\n' +
            'NEXT STEPS:\n' +
            '• View your submitted responses: ' + orgUrl + '/lightning/cmp/c__employeeQuestionAnswer\n' +
            '• Check for manager feedback (available once reviewed): Same link above\n' +
          
            'Thank you for your participation in our continuous improvement process.\n\n' +
            'Best regards,\n' +
            'EvalHub System\n' +
            'Automated Email - Please do not reply';
            
        sendEmail(user.Email, subject, body);
    }
    
    private static void sendEmail(String toEmail, String subject, String body) {
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(new List<String>{toEmail});
        email.setSubject(subject);
        email.setPlainTextBody(body);
        Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{email});
    }
    
    private static String sendManagerEmail(User user, String orgUrl) {
        try {
            UserRole userRole = [SELECT ParentRoleId FROM UserRole WHERE Id = :user.UserRoleId];
            
            if (userRole.ParentRoleId == null) {
                return '. No manager found.';
            }
            
            List<User> managers = [SELECT Name, Email FROM User WHERE UserRoleId = :userRole.ParentRoleId LIMIT 1];
            
            if (managers.isEmpty()) {
                return '. No manager found in parent role.';
            }
            
            User manager = managers[0];
            
            String subject = 'Team Member Feedback Submission - Review Required';
            
            String body = 'Dear ' + manager.Name + ',\n\n' +
                'This is to notify you that ' + user.Name + ' has submitted their feedback evaluation and is awaiting your review.\n\n' +
                'EMPLOYEE DETAILS:\n' +
                '• Name: ' + user.Name + '\n' +
                '• Email: ' + user.Email + '\n' +
                '• Submission Date: ' + DateTime.now().format('MMMM dd, yyyy \'at\' hh:mm a') + '\n\n' +
                'ACTION REQUIRED:\n' +
                '• Review submission and provide feedback: ' + orgUrl + '/lightning/cmp/c__viewAllExecutiveUnderManager\n' +
                '• Complete your manager response within 5 business days\n' +
                '• Schedule a follow-up discussion if needed\n\n' +
               
                'Thank you for your leadership and commitment to team development.\n\n' +
                'Best regards,\n' +
                'EvalHub System\n' +
                'Automated Email - Please do not reply';
            
            sendEmail(manager.Email, subject, body);
            
            return ' and Manager: ' + manager.Name + ' (' + manager.Email + ')';
            
        } catch (Exception e) {
            return '. Manager email failed: ' + e.getMessage();
        }
    }

    public static void sendExecutiveEmailWhenManagerSubmitsFeedback(User user, String orgUrl) {
      
    }
}

