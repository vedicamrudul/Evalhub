public with sharing class UserController {
    @AuraEnabled(cacheable=true)
    public static User getCurrentUser(){
        // Retrieve the current user using the UserInfo class
        return [SELECT Id, Name, IsActive, Profile.Name, department__c, ManagerId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
    }  
}