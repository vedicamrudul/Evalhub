public with sharing class EmailController {
    // below is to send the email only and not the feedbakc object.
    @AuraEnabled
   public static String sendEmailOnFeedbackSubmit(){
    String debugInfo = '';
    
    try {
        // lets get id of the current user.
        Id userId = UserInfo.getUserId();
        String parentUserEmail = '';
        String userName = '';
        String userEmail = '';
        
        // lets get the user object.
        User user = [SELECT Id, UserRoleId, Email, Name FROM User WHERE Id = :userId];

        userName = user.Name;
        userEmail = user.Email;
        
        debugInfo += 'DEBUG: Current User - Name: ' + userName + ', Email: ' + userEmail + '. ';
        
        // Check organization type
        Organization org = [SELECT Id, Name, OrganizationType FROM Organization LIMIT 1];
        debugInfo += 'Org Type: ' + org.OrganizationType + ' (' + org.Name + '). ';
        
        // lets get the parent role id.
        UserRole myRole = [
            SELECT ParentRoleId
            FROM UserRole
            WHERE Id = :user.UserRoleId
        ];

        debugInfo += 'Parent Role ID: ' + myRole.ParentRoleId + '. ';

        // send email to user.
        Messaging.SingleEmailMessage email2 = new Messaging.SingleEmailMessage();
        email2.setToAddresses(new List<String>{userEmail});
        email2.setSubject('Feedback Submitted');
        email2.setPlainTextBody('Thank you for submitting your Feedback ' + userName);
        
        // Try sending user email
        try {
            Messaging.SendEmailResult[] results2 = Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{email2});
            
            if (results2[0].isSuccess()) {
                debugInfo += 'SUCCESS: User email sent to ' + userEmail + '. ';
            } else {
                debugInfo += 'FAILED: User email failed - ' + results2[0].getErrors()[0].getMessage() + '. ';
            }
        } catch (Exception e) {
            debugInfo += 'EXCEPTION: User email exception - ' + e.getMessage() + '. ';
        }

        if(myRole.ParentRoleId != null){
            // lets get the parent user.
            List<User> parentUsers = [SELECT Id, Email, Name FROM User WHERE UserRoleId = :myRole.ParentRoleId LIMIT 1];
            
            if(!parentUsers.isEmpty()){
                User parentUser = parentUsers[0];
                parentUserEmail = parentUser.Email;
                String parentUserName = parentUser.Name;
                
                debugInfo += 'Manager Found - Name: ' + parentUserName + ', Email: ' + parentUserEmail + '. ';

                // send email to parent.
                Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
                email.setToAddresses(new List<String>{parentUserEmail});
                email.setSubject('Feedback Submitted by Team Member');
                email.setPlainTextBody('Feedback has been submitted by ' + userName + ' (' + userEmail + ')');
                
                // Try sending manager email
                try {
                    Messaging.SendEmailResult[] results = Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{email});
                    
                    if (results[0].isSuccess()) {
                        debugInfo += 'SUCCESS: Manager email sent to ' + parentUserEmail + '. ';
                        return 'SUCCESS: ' + debugInfo + 'Both emails sent successfully.';
                    } else {
                        debugInfo += 'FAILED: Manager email failed - ' + results[0].getErrors()[0].getMessage() + '. ';
                        return 'PARTIAL SUCCESS: ' + debugInfo + 'User email sent but manager email failed.';
                    }
                } catch (Exception e) {
                    debugInfo += 'EXCEPTION: Manager email exception - ' + e.getMessage() + '. ';
                    return 'PARTIAL SUCCESS: ' + debugInfo + 'User email sent but manager email failed.';
                }
            } else {
                debugInfo += 'No manager found for parent role. ';
                return 'SUCCESS: ' + debugInfo + 'User email sent, no manager exists.';
            }
        } else {
            debugInfo += 'No parent role exists. ';
            return 'SUCCESS: ' + debugInfo + 'User email sent, no parent role exists.';
        }
    } catch (Exception mainException) {
        debugInfo += 'MAIN EXCEPTION: ' + mainException.getMessage() + '. ';
        return 'ERROR: ' + debugInfo + 'Email sending failed completely.';
    }
   }
}