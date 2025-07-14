public with sharing class UserController {
    @AuraEnabled(cacheable=true)
    public static User getCurrentUser(){
        System.debug('Here');
        User currentUser = [SELECT Id, Name, IsActive, Profile.Name, department__c, ManagerId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        System.debug('Current User: ' + currentUser);
        // Retrieve the current user using the UserInfo class
        return currentUser;
    }  
    
    @AuraEnabled(cacheable=true)
    public static List<User> getUsersUnderCurrentUser() {
        // Get current user's ID automatically
        Id currentUserId = UserInfo.getUserId();

        // Get current user's role
        User currentUser = [SELECT UserRoleId FROM User WHERE Id = :currentUserId];

        // If user has no role, return empty list
        if(currentUser.UserRoleId == null) {
            return new List<User>();
        }
        
        // Get ONLY DIRECT subordinate role IDs (not recursive)
        Set<Id> directSubRoleIds = new Set<Id>();
        
        List<UserRole> directSubRoles = [
            SELECT Id 
            FROM UserRole 
            WHERE ParentRoleId = :currentUser.UserRoleId
        ];
        
        for(UserRole r : directSubRoles) {
            directSubRoleIds.add(r.Id);
        }
        
        // Get all active users in those direct subordinate roles
        List<User> directSubordinateUsers = [
            SELECT Id, Name, Email, UserRole.Name, department__c, Phone
            FROM User 
            WHERE UserRoleId IN :directSubRoleIds
            ORDER BY Name
            LIMIT 1000 // Safety limit
        ];
        
        return directSubordinateUsers;
    }



    // --------------------------------------------------------------------------------------
    // Lets do for admin.
    // we have to get all users (literally all users) except the system admin and display their names and details.
    // when admin clicks on a user, we will show the feedback for that user (their response) and also get the manager response for that user- by using active form and manager repsonse.

//  ---------------------------------------------------------------------------------------
//  FUNCTION TO GET ALL USERS EXCEPT SYSTEM ADMIN
//  ---------------------------------------------------------------------------------------
@AuraEnabled(cacheable=true)
public static List<User> getAllUsers() {
    // Get all (otherwise active but since here we cannot keep more than one active user lets not do that) users except system admin
    List<User> users = [
        SELECT Id, Name, Email, department__c
        FROM User
        WHERE Profile.Name != 'System Administrator'
        AND department__c != null
        ORDER BY Name
    ];
    if (users.isEmpty()) {
        throw new AuraHandledException('No users found.');
    }
    return users;
   
}

}
