public with sharing class UserController {
    @AuraEnabled(cacheable=true)
    public static User getCurrentUser(){
        // Retrieve the current user using the UserInfo class
        return [SELECT Id, Name, IsActive, Profile.Name, department__c, ManagerId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
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
}
