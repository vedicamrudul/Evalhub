public with sharing class EmailController {
    
    @AuraEnabled
    public static String sendEmailOnFeedbackSubmit(){
        try {
            // Get current user
            User user = [SELECT Id, UserRoleId, Email, Name FROM User WHERE Id = :UserInfo.getUserId()];
            
            // Send email to user
            sendEmail(user.Email, 'Feedback Submitted', 'Thank you for submitting your feedback, ' + user.Name + '!');
            
            // Check if user has a manager
            String managerResult = sendManagerEmail(user);
            
            // Return success message
            return 'Email sent to: ' + user.Name + ' (' + user.Email + ')' + managerResult;
            
        } catch (Exception e) {
            return 'Error sending emails: ' + e.getMessage();
        }
    }
    
    // Helper method to send individual emails
    private static void sendEmail(String toEmail, String subject, String body) {
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(new List<String>{toEmail});
        email.setSubject(subject);
        email.setPlainTextBody(body);
        Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{email});
    }
    
    // Helper method to handle manager email
    private static String sendManagerEmail(User user) {
        try {
            // Get user's role
            UserRole userRole = [SELECT ParentRoleId FROM UserRole WHERE Id = :user.UserRoleId];
            
            // If no parent role, no manager
            if (userRole.ParentRoleId == null) {
                return '. No manager found.';
            }
            
            // Find manager
            List<User> managers = [SELECT Name, Email FROM User WHERE UserRoleId = :userRole.ParentRoleId LIMIT 1];
            
            if (managers.isEmpty()) {
                return '. No manager found in parent role.';
            }
            
            User manager = managers[0];
            sendEmail(manager.Email, 'Team Member Feedback Submitted', 
                     'Feedback has been submitted by ' + user.Name + ' (' + user.Email + ')');
            
            return ' and Manager: ' + manager.Name + ' (' + manager.Email + ')';
            
        } catch (Exception e) {
            return '. Manager email failed: ' + e.getMessage();
        }
    }
}