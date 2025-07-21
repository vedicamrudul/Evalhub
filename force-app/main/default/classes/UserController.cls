public with sharing class UserController {
    @AuraEnabled(cacheable=true)
    public static User getCurrentUser(){
        User currentUser = [SELECT Id, Name, IsActive, Profile.Name, department__c, ManagerId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        return currentUser;
    }  
    
    @AuraEnabled(cacheable=true)
    public static List<User> getUsersUnderCurrentUser() {
        Id currentUserId = UserInfo.getUserId();

        User currentUser = [SELECT UserRoleId FROM User WHERE Id = :currentUserId];

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
        
        List<User> directSubordinateUsers = [
            SELECT Id, Name, Email, UserRole.Name, department__c, Phone
            FROM User 
            WHERE UserRoleId IN :directSubRoleIds
            ORDER BY Name
            LIMIT 100
        ];
        
        return directSubordinateUsers;
    }

    @AuraEnabled(cacheable=true)
    public static List<User> getAllUsers() {
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
