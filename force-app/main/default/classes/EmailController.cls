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

