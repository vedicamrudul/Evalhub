public with sharing class QuestionsController {
    
    public class QuestionAnswerPair {
        @AuraEnabled
        public String questionId { get; set; }
        @AuraEnabled
        public String answer { get; set; }
    }

    public class ManagerResponse {
        @AuraEnabled
        public String managerResponseText { get; set; }
        @AuraEnabled
        public String employeeId { get; set; }
    }

    public class UserPermissions {
        @AuraEnabled
        public Boolean canViewAllDepartments { get; set; }
        @AuraEnabled
        public Boolean canViewBranchFilters { get; set; }
        @AuraEnabled
        public String userDepartment { get; set; }
        @AuraEnabled
        public String userRole { get; set; }
        @AuraEnabled
        public Id userId { get; set; }
    }
    
    private static User validateCurrentUser() {
        User currentUser = UserController.getCurrentUser();
        if (currentUser == null || !currentUser.IsActive) {
            throw new AuraHandledException('User is not active or does not exist.');
        }
        return currentUser;
    }

    @AuraEnabled(cacheable=true)
    public static UserPermissions getCurrentUserPermissions() {
        User currentUser = validateCurrentUser();
        
        UserPermissions permissions = new UserPermissions();
        permissions.userId = currentUser.Id;
        permissions.userDepartment = currentUser.department__c;
        
        // Get user role information
        User userWithRole = [SELECT Id, UserRole.Name FROM User WHERE Id = :currentUser.Id LIMIT 1];
        permissions.userRole = userWithRole.UserRole?.Name;
        
        // Check if user has executive privileges (roles starting with 'C' or containing 'chief')
        Boolean isExecutive = false;
        if (permissions.userRole != null) {
            String roleLower = permissions.userRole.toLowerCase();
            isExecutive = permissions.userRole.startsWith('C') || roleLower.contains('chief');
        }
        
        permissions.canViewAllDepartments = isExecutive;
        permissions.canViewBranchFilters = isExecutive;
        
        return permissions;
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getAllUserResponsesForAdminWithPermissions(Id formId) {
        UserPermissions permissions = getCurrentUserPermissions();
        
        if (permissions.canViewAllDepartments) {
            // Executive users can see all responses (existing logic)
            return getAllUserResponsesForAdmin(formId);
        } else {
            // Regular users can only see subordinates + their own response
            return getUserResponsesForManager(formId, permissions.userId);
        }
    }

    private static Map<String, Object> getUserResponsesForManager(Id formId, Id managerId) {
        validateCurrentUser();

        Feedback_Form__c form = [
            SELECT Id, Title__c, Name, department__c 
            FROM Feedback_Form__c 
            WHERE Id = :formId
            LIMIT 1
        ];
        
        if (form == null) {
            throw new AuraHandledException('Form not found');
        }
        
        List<Feedback_Question__c> questions = getQuestionsByFormId(formId);
        
        // Get subordinate users + current user
        List<User> subordinateUsers = UserController.getUsersUnderCurrentUser();
        User currentUser = [SELECT Id, Name, department__c, UserRole.Name FROM User WHERE Id = :managerId LIMIT 1];
        
        List<User> allUsers = new List<User>();
        allUsers.add(currentUser); // Add current user
        allUsers.addAll(subordinateUsers); // Add subordinates
        
        Map<String, Object> result = new Map<String, Object>();
        result.put('currentUserRole', currentUser.UserRole?.Name);
        result.put('isCBO', false); // Regular users don't get CBO features
        
        return buildAdminResponseData(form, questions, allUsers);
    }

    @AuraEnabled(cacheable=true)
    public static List<Feedback_Form__c> getFormsBasedOnUserRole() {
        UserPermissions permissions = getCurrentUserPermissions();
        
        Date twelveMonthsAgo = System.today().addMonths(-12);
        
        if (permissions.canViewAllDepartments) {
            // Executive users can see all forms
            return [
                SELECT Id, Title__c, department__c, Applicable_Month__c, Active_Flag__c
                FROM Feedback_Form__c
                WHERE Applicable_Month__c >= :twelveMonthsAgo
                ORDER BY Applicable_Month__c DESC
            ];
        } else {
            // Regular users can only see forms for their department
            return [
                SELECT Id, Title__c, department__c, Applicable_Month__c, Active_Flag__c
                FROM Feedback_Form__c
                WHERE Applicable_Month__c >= :twelveMonthsAgo
                AND department__c = :permissions.userDepartment
                ORDER BY Applicable_Month__c DESC
            ];
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Feedback_Form__c> getFilteredFormsBasedOnUserRole(String department, Integer month, Integer year) {
        UserPermissions permissions = getCurrentUserPermissions();
        
        String query = 'SELECT Id, Title__c, department__c, Applicable_Month__c, Active_Flag__c FROM Feedback_Form__c';
        
        List<String> conditions = new List<String>();
        Map<String, Object> bindMap = new Map<String, Object>();
        Integer index = 0;

        // Always add the 12-month filter
        conditions.add('Applicable_Month__c >= :p' + index);
        bindMap.put('p' + index, System.today().addMonths(-12));
        index++;

        // Add department filter based on user role
        if (!permissions.canViewAllDepartments) {
            // Regular users can only see their department
            conditions.add('department__c = :p' + index);
            bindMap.put('p' + index, permissions.userDepartment);
            index++;
        } else if (department != null && department != 'All') {
            // Executive users can filter by department
            conditions.add('department__c = :p' + index);
            bindMap.put('p' + index, department);
            index++;
        }

        if (month != null && month > 0) {
            conditions.add('CALENDAR_MONTH(Applicable_Month__c) = :p' + index);
            bindMap.put('p' + index, month);
            index++;
        }

        if (year != null && year > 0) {
            conditions.add('CALENDAR_YEAR(Applicable_Month__c) = :p' + index);
            bindMap.put('p' + index, year);
            index++;
        }

        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }

        query += ' ORDER BY Applicable_Month__c DESC';

        return Database.queryWithBinds(query, bindMap, AccessLevel.USER_MODE);
    }
    
    private static Feedback_Form__c getActiveFormByDepartment(String department) {
        List<Feedback_Form__c> forms = [
            SELECT Id, Title__c, Name, department__c 
            FROM Feedback_Form__c 
            WHERE Active_Flag__c = true 
            AND department__c = :department 
            LIMIT 1
        ];
        return forms.isEmpty() ? null : forms[0];
    }

    @AuraEnabled(cacheable=true)
    public static List<Feedback_Question__c> getQuestionsByFormId(Id formId) {
        return [
            SELECT Id, Question_Text__c, Input_Type__c, Picklist_Values__c, Feedback_Form__c
            FROM Feedback_Question__c 
            WHERE Feedback_Form__c = :formId
            ORDER BY CreatedDate
        ];
    }
    
    private static Map<Id, Feedback_Response__c> getResponseMapForUser(List<Feedback_Question__c> questions, Id userId) {
        List<Feedback_Response__c> responses = [
            SELECT Id, Question_Lookup__c, Rating_Answer__c
            FROM Feedback_Response__c
            WHERE Responder__c = :userId
            AND Respondent__c = :userId
            AND Question_Lookup__c IN :questions
        ];
        
        Map<Id, Feedback_Response__c> responseMap = new Map<Id, Feedback_Response__c>();
        for (Feedback_Response__c res : responses) {
            responseMap.put(res.Question_Lookup__c, res);
        }
        return responseMap;
    }
    
    private static String getManagerResponseText(Id userId, Id formId) {
        List<Manager_Response__c> managerResponses = [
            SELECT Id, Manager_Response_Test__c
            FROM Manager_Response__c 
            WHERE User_Lookup__c = :userId
            AND Feedback_Form_Lookup__c = :formId
            LIMIT 1
        ];
        return managerResponses.isEmpty() ? '' : managerResponses[0].Manager_Response_Test__c;
    }
    
    public static List<Map<String, Object>> getScaleConfigurationsForGroup(String inputType, String scaleGroup) {
        List<Input_Scale_Config__mdt> configs = [
            SELECT Label, Display_Label__c, Value_Stored__c, Order__c
            FROM Input_Scale_Config__mdt
            WHERE Active__c = true
            AND Input_Type__c = :inputType
            AND Scale_Group__c = :scaleGroup
            ORDER BY Order__c
        ];
        
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        for (Input_Scale_Config__mdt config : configs) {
            result.add(new Map<String, Object>{
                'label' => config.Display_Label__c,
                'value' => config.Value_Stored__c,
                'order' => config.Order__c
            });
        }
        return result;
    }
    
    public static String decodeResponse(String storedResponse, String questionType, Boolean isEmployeeView) {
        if (String.isBlank(storedResponse)) {
            return '';
        }
        
        if (questionType == 'Emoji' && storedResponse.startsWith('emoji//')) {
            return decodeEmojiResponse(storedResponse, isEmployeeView);
        }
        
        if (questionType == 'Rating') {
            return decodeRatingResponse(storedResponse, isEmployeeView);
        }
        
        return storedResponse;
    }
    
    private static String decodeEmojiResponse(String storedResponse, Boolean isEmployeeView) {
        List<String> parts = storedResponse.split('//');
        if (parts.size() != 3) {
            return storedResponse;
        }
        
        String scaleGroup = parts[1];
        String label = parts[2];
        
        List<Input_Scale_Config__mdt> configs = queryEmojiConfig(scaleGroup, label);
        
        if (configs.isEmpty()) {
            return storedResponse;
        }
        
        Input_Scale_Config__mdt config = configs[0];
        return isEmployeeView ? 
            config.Value_Stored__c + ' (' + config.Display_Label__c + ')' : 
            config.Display_Label__c;
    }
    
    private static List<Input_Scale_Config__mdt> queryEmojiConfig(String scaleGroup, String label) {
        List<Input_Scale_Config__mdt> configs = [
            SELECT Value_Stored__c, Display_Label__c, Label
            FROM Input_Scale_Config__mdt
            WHERE Active__c = true
            AND Input_Type__c = 'emoji'
            AND Scale_Group__c = :scaleGroup
            AND Label = :label
            LIMIT 1
        ];
        
        if (configs.isEmpty()) {
            configs = [
                SELECT Value_Stored__c, Display_Label__c, Label
                FROM Input_Scale_Config__mdt
                WHERE Active__c = true
                AND Input_Type__c = 'emoji'
                AND Scale_Group__c = :scaleGroup
                AND Display_Label__c = :label
                LIMIT 1
            ];
        }
        
        return configs;
    }
    
    private static String decodeRatingResponse(String storedResponse, Boolean isEmployeeView) {
        Integer ratingValue = null;
        String scaleGroup = null;
        
        if (storedResponse.startsWith('rating//')) {
            List<String> parts = storedResponse.split('//');
            if (parts.size() == 3) {
                scaleGroup = parts[1];
                try {
                    ratingValue = Integer.valueOf(parts[2]);
                } catch (Exception e) {
                    return storedResponse;
                }
            }
        } else {
            try {
                ratingValue = Integer.valueOf(storedResponse);
            } catch (Exception e) {
                return storedResponse;
            }
        }
        
        if (ratingValue == null || ratingValue < 1 || ratingValue > 5) {
            return storedResponse;
        }
        
        if (isEmployeeView) {
            String icon = '⭐';
            if (String.isNotBlank(scaleGroup)) {
                icon = getRatingIcon(scaleGroup);
            }
            return icon.repeat(ratingValue);
        } else {
            return ratingValue + '/5';
        }
    }
    
    private static String getRatingIcon(String scaleGroup) {
        List<Input_Scale_Config__mdt> configs = [
            SELECT Value_Stored__c, Display_Label__c
            FROM Input_Scale_Config__mdt
            WHERE Active__c = true
            AND Input_Type__c = 'rating'
            AND Scale_Group__c = :scaleGroup
            LIMIT 1
        ];
        
        if (!configs.isEmpty()) {
            return configs[0].Display_Label__c != null ? 
                configs[0].Display_Label__c : configs[0].Value_Stored__c;
        }
        return '⭐';
    }
    
    private static Map<String, Object> buildQuestionData(Feedback_Question__c question, String answer, Boolean hasResponse, Boolean isEmployeeView) {
        Map<String, Object> qData = new Map<String, Object>{
            'id' => question.Id,
            'questionText' => question.Question_Text__c
        };
        
        if (isEmployeeView) {
            qData.put('inputType', question.Input_Type__c);
            qData.put('picklistValues', question.Picklist_Values__c);
            addInputTypeSpecificData(qData, question);
        }
        
        if (hasResponse) {
            qData.put('answer', decodeResponse(answer, question.Input_Type__c, isEmployeeView));
            qData.put('hasResponse', true);
        } else {
            qData.put('hasResponse', false);
        }
        
        return qData;
    }
    
    private static void addInputTypeSpecificData(Map<String, Object> qData, Feedback_Question__c question) {
        if (question.Input_Type__c == 'Rating' || question.Input_Type__c == 'Emoji') {
            String scaleGroup = question.Picklist_Values__c;
            if (String.isNotBlank(scaleGroup)) {
                List<Map<String, Object>> scaleOptions = getScaleConfigurationsForGroup(question.Input_Type__c, scaleGroup);
                qData.put('scaleOptions', scaleOptions);
                qData.put('scaleGroup', scaleGroup);
            }
        } else if (question.Input_Type__c == 'Slider') {
            qData.put('sliderMin', 1);
            qData.put('sliderMax', 10);
        } else if (question.Input_Type__c == 'Picklist') {
            String picklistData = question.Picklist_Values__c;
            if (picklistData == 'Work_Energy' || picklistData == 'Levels') {
                List<Map<String, Object>> picklistOptions = getScaleConfigurationsForGroup('picklist', picklistData);
                qData.put('picklistOptions', picklistOptions);
                qData.put('isMetadataPicklist', true);
                qData.put('picklistGroup', picklistData);
            } else {
                qData.put('picklistValues', picklistData);
                qData.put('isMetadataPicklist', false);
            }
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getFeedbackData(){
        User currentUser = validateCurrentUser();
        
        // Get the employee response using the current user ID with employee view formatting
        Map<String, Object> response = getEmployeeResponseForManager(currentUser.Id, true);
        
        // Adjust response keys for employee context
        if (response.containsKey('hasEmployeeSubmitted')) {
            response.put('hasSubmitted', response.get('hasEmployeeSubmitted'));
            response.remove('hasEmployeeSubmitted');
        }
        
        return response;
    }
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getEmployeeResponseForManager(Id employeeId) {
        return getEmployeeResponseForManager(employeeId, false);
    }
    
    public static Map<String, Object> getEmployeeResponseForManager(Id employeeId, Boolean isEmployeeView) {
        validateCurrentUser();
        
        if (employeeId == null) {
            throw new AuraHandledException('Employee ID cannot be null.');
        }
        User employee = [SELECT department__c FROM User WHERE Id = :employeeId LIMIT 1];
        
        Feedback_Form__c form = getActiveFormByDepartment(employee.department__c);
        Map<String, Object> response = new Map<String, Object>();
        
        if (form == null) {
            response.put('formExists', false);
            return response;
        }
        
        response.put('formExists', true);
        
        List<Feedback_Question__c> formQuestions = getQuestionsByFormId(form.Id);
        if (formQuestions.isEmpty()) {
            throw new AuraHandledException('No questions found for the active form.');
        }
        
        Map<Id, Feedback_Response__c> employeeResponseMap = getResponseMapForUser(formQuestions, employeeId);
        
        List<Map<String, Object>> questions = new List<Map<String, Object>>();
        for (Feedback_Question__c question : formQuestions) {
            String answer = '';
            Boolean hasResponse = false;
            
            if (employeeResponseMap.containsKey(question.Id)) {
                answer = employeeResponseMap.get(question.Id).Rating_Answer__c;
                hasResponse = true;
            }
            
            questions.add(buildQuestionData(question, answer, hasResponse, isEmployeeView));
        }
        
        String managerResponseText = getManagerResponseText(employeeId, form.Id);
        
        response.put('questions', questions);
        response.put('hasEmployeeSubmitted', !employeeResponseMap.isEmpty());
        response.put('hasManagerSubmitted', String.isNotBlank(managerResponseText));
        response.put('managerResponseText', managerResponseText);
        
        return response;
    }
    
    @AuraEnabled
    public static String submitManagerResponse(ManagerResponse response) {
        validateCurrentUser();
        
        if (response == null || String.isBlank(response.managerResponseText) || String.isBlank(response.employeeId)) {
            throw new AuraHandledException('Manager response text and employee ID cannot be blank.');
        }
        
        User employee = [SELECT department__c FROM User WHERE Id = :response.employeeId LIMIT 1];
        Feedback_Form__c form = getActiveFormByDepartment(employee.department__c);
        
        if (form == null) {
            throw new AuraHandledException('No active form found for employee department.');
        }
        
        Manager_Response__c managerResponse = new Manager_Response__c(
            Manager_Response_Test__c = response.managerResponseText,
            User_Lookup__c = response.employeeId,
            Feedback_Form_Lookup__c = form.Id
        );
        
        try {
            insert managerResponse;
            return 'Manager response submitted successfully.';
        } catch (Exception e) {
            throw new AuraHandledException('Error submitting manager response: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static String submitFeedback(List<QuestionAnswerPair> answers, Id respondentId) {
        User currentUser = validateCurrentUser();
        
        if (answers == null || answers.isEmpty()) {
            throw new AuraHandledException('No answers provided.');
        }
        
        List<Feedback_Response__c> responsesToInsert = new List<Feedback_Response__c>();
        for (QuestionAnswerPair answer : answers) {
            if (String.isBlank(answer.questionId) || String.isBlank(answer.answer)) {
                throw new AuraHandledException('Question ID and answer cannot be blank.');
            }
            responsesToInsert.add(new Feedback_Response__c(
                Question_Lookup__c = answer.questionId,
                Rating_Answer__c = answer.answer,
                Responder__c = currentUser.Id, 
                Respondent__c = respondentId 
            ));
        }
        
        try {
            insert responsesToInsert;
            return 'Feedback submitted successfully.';
        } catch (DmlException e) {
            throw new AuraHandledException('Error submitting feedback: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getAllUserResponsesForAdmin(Id formId) {
        validateCurrentUser();

        Id currentUserId = UserInfo.getUserId();
        User currentUser = [Select UserRole.Name from User where Id = :currentUserId];
        
        Feedback_Form__c form = [
            SELECT Id, Title__c, Name, department__c 
            FROM Feedback_Form__c 
            WHERE Id = :formId
            LIMIT 1
        ];
        
        if (form == null) {
            throw new AuraHandledException('Form not found');
        }
        
        List<Feedback_Question__c> questions = getQuestionsByFormId(formId);
        
        Map<String, Object> result = new Map<String, Object>();
        result.put('currentUserRole', currentUser.UserRole.Name);
        result.put('isCBO', currentUser.UserRole.Name == 'CBO');
        
        if(currentUser.UserRole.Name == 'CBO') {
            // For CBO, get users with branch information
            List<BranchUserAllocation__c> branchAllocations = [
                SELECT User__r.Id, User__r.Name, User__r.department__c, User__r.UserRole.Name, 
                       Branch__r.Name, Branch__r.Region__c, Branch__r.Cluster__c, Branch__r.Id
                FROM BranchUserAllocation__c
                WHERE User__r.Id != :UserInfo.getUserId()
                AND User__r.department__c = :form.department__c
            ];
            
            Set<Id> userIds = new Set<Id>();
            Map<Id, Map<String, String>> userBranchMap = new Map<Id, Map<String, String>>();
            Set<String> allRegions = new Set<String>();
            Set<String> allClusters = new Set<String>();
            Set<String> allBranches = new Set<String>();
            
            for(BranchUserAllocation__c allocation : branchAllocations) {
                userIds.add(allocation.User__r.Id);
                
                userBranchMap.put(allocation.User__r.Id, new Map<String, String>{
                    'branchId' => allocation.Branch__r.Id,
                    'branchName' => allocation.Branch__r.Name,
                    'Region' => allocation.Branch__r.Region__c,
                    'Cluster' => allocation.Branch__r.Cluster__c
                });
                
                if(String.isNotBlank(allocation.Branch__r.Region__c)) {
                    allRegions.add(allocation.Branch__r.Region__c);
                }
                if(String.isNotBlank(allocation.Branch__r.Cluster__c)) {
                    allClusters.add(allocation.Branch__r.Cluster__c);
                }
                if(String.isNotBlank(allocation.Branch__r.Name)) {
                    allBranches.add(allocation.Branch__r.Name);
                }
            }
            
            List<User> allUsers = [
                SELECT Id, Name, department__c, UserRole.Name
                FROM User
                WHERE Id IN :userIds
            ];
            
            List<Map<String, String>> RegionOptions = new List<Map<String, String>>();
            for(String Region : allRegions) {
                RegionOptions.add(new Map<String, String>{'label' => Region, 'value' => Region});
            }
            
            List<Map<String, String>> ClusterOptions = new List<Map<String, String>>();
            for(String Cluster : allClusters) {
                ClusterOptions.add(new Map<String, String>{'label' => Cluster, 'value' => Cluster});
            }
            
            List<Map<String, String>> branchOptions = new List<Map<String, String>>();
            for(String branch : allBranches) {
                branchOptions.add(new Map<String, String>{'label' => branch, 'value' => branch});
            }
            
            result.put('RegionOptions', RegionOptions);
            result.put('ClusterOptions', ClusterOptions);
            result.put('branchOptions', branchOptions);
            result.put('userBranchMap', userBranchMap);

            return buildAdminResponseDataWithBranch(form, questions, allUsers, userBranchMap, result);
        } else {
            List<User> allUsers = [
                SELECT Id, Name, department__c, UserRole.Name
                FROM User
                WHERE Id != :UserInfo.getUserId()
                AND department__c = :form.department__c
             ];
            
            return buildAdminResponseData(form, questions, allUsers);
        }
    }
    
    private static Map<String, Object> buildAdminResponseData(Feedback_Form__c form, List<Feedback_Question__c> questions, List<User> allUsers) {
        Map<String, Object> result = new Map<String, Object>();
        
        List<Map<String, String>> questionList = new List<Map<String, String>>();
        for (Feedback_Question__c q : questions) {
            questionList.add(new Map<String, String>{
                'id' => q.Id,
                'text' => q.Question_Text__c,
                'type' => q.Input_Type__c,
                'picklistValues' => q.Picklist_Values__c
            });
        }
        
        result.put('questions', questionList);
        result.put('formName', form.Name);
        result.put('formTitle', form.Title__c);
        result.put('formDepartment', form.department__c);
        
        Map<Id, Map<Id, String>> userQuestionResponseMap = getUserQuestionResponseMap(questions, allUsers);
        Map<Id, String> managerResponseMap = getManagerResponseMap(allUsers, form.Id);
        
        List<Map<String, Object>> userResponses = buildUserResponsesList(allUsers, questions, userQuestionResponseMap, managerResponseMap);
        result.put('userResponses', userResponses);
        
        return result;
    }

    private static Map<String, Object> buildAdminResponseDataWithBranch(Feedback_Form__c form, List<Feedback_Question__c> questions, List<User> allUsers, Map<Id, Map<String, String>> userBranchMap, Map<String, Object> result) {
        Map<String, Object> finalResult = new Map<String, Object>();
        finalResult.putAll(result);

        List<Map<String, String>> questionList = new List<Map<String, String>>();
        for (Feedback_Question__c q : questions) {
            questionList.add(new Map<String, String>{
                'id' => q.Id,
                'text' => q.Question_Text__c,
                'type' => q.Input_Type__c,
                'picklistValues' => q.Picklist_Values__c
            });
        }
        
        finalResult.put('questions', questionList);
        finalResult.put('formName', form.Name);
        finalResult.put('formTitle', form.Title__c);
        finalResult.put('formDepartment', form.department__c);
        
        Map<Id, Map<Id, String>> userQuestionResponseMap = getUserQuestionResponseMap(questions, allUsers);
        Map<Id, String> managerResponseMap = getManagerResponseMap(allUsers, form.Id);
        
        List<Map<String, Object>> userResponses = new List<Map<String, Object>>();
        for (User u : allUsers) {
            Map<String, Object> userData = new Map<String, Object>{
                'userId' => u.Id,
                'userName' => u.Name,
                'department' => u.department__c,
                'role' => u.UserRole?.Name,
                'branch' => userBranchMap.get(u.Id),
                'managerResponse' => managerResponseMap.get(u.Id),
                'hasManagerResponse' => managerResponseMap.containsKey(u.Id),
                'hasSubmitted' => userQuestionResponseMap.containsKey(u.Id)
            };
            
            List<Map<String, String>> questionResponses = new List<Map<String, String>>();
            for (Feedback_Question__c q : questions) {
                String answer = '';
                Boolean hasResponse = false;
                
                if (userQuestionResponseMap.containsKey(u.Id) && 
                    userQuestionResponseMap.get(u.Id).containsKey(q.Id)) {
                    String storedAnswer = userQuestionResponseMap.get(u.Id).get(q.Id);
                    answer = decodeResponse(storedAnswer, q.Input_Type__c, false);
                    hasResponse = true;
                }
                
                questionResponses.add(new Map<String, String>{
                    'questionId' => q.Id,
                    'answer' => answer,
                    'hasResponse' => String.valueOf(hasResponse)
                });
            }
            
            userData.put('questionResponses', questionResponses);
            userResponses.add(userData);
        }
        
        finalResult.put('userResponses', userResponses);
        return finalResult;
    }

   
    private static Map<Id, Map<Id, String>> getUserQuestionResponseMap(List<Feedback_Question__c> questions, List<User> allUsers) {
        List<Feedback_Response__c> allResponses = [
            SELECT Id, Question_Lookup__c, Rating_Answer__c, Respondent__c
            FROM Feedback_Response__c
            WHERE Question_Lookup__c IN :questions
            AND Respondent__c IN :allUsers
            ORDER BY Respondent__r.Name, Question_Lookup__c
        ];
        
        Map<Id, Map<Id, String>> userQuestionResponseMap = new Map<Id, Map<Id, String>>();
        for (Feedback_Response__c res : allResponses) {
            if (!userQuestionResponseMap.containsKey(res.Respondent__c)) {
                userQuestionResponseMap.put(res.Respondent__c, new Map<Id, String>());
            }
            userQuestionResponseMap.get(res.Respondent__c).put(res.Question_Lookup__c, res.Rating_Answer__c);
        }
        
        return userQuestionResponseMap;
    }
    
    private static Map<Id, String> getManagerResponseMap(List<User> allUsers, Id formId) {
        List<Manager_Response__c> managerResponses = [
            SELECT Id, Manager_Response_Test__c, User_Lookup__c
            FROM Manager_Response__c
            WHERE User_Lookup__c IN :allUsers
            AND Feedback_Form_Lookup__c = :formId
        ];
        
        Map<Id, String> managerResponseMap = new Map<Id, String>();
        for (Manager_Response__c mr : managerResponses) {
            managerResponseMap.put(mr.User_Lookup__c, mr.Manager_Response_Test__c);
        }
        
        return managerResponseMap;
    }
    
    private static List<Map<String, Object>> buildUserResponsesList(
        List<User> allUsers, 
        List<Feedback_Question__c> questions, 
        Map<Id, Map<Id, String>> userQuestionResponseMap, 
        Map<Id, String> managerResponseMap
    ) {
        List<Map<String, Object>> userResponses = new List<Map<String, Object>>();
        
        for (User u : allUsers) {
            if (u.department__c == null || u.Name == null || 
                u.Name.contains('Automated Process') || u.Name.contains('Integration User')) {
                continue;
            }
            
            Map<String, Object> userData = new Map<String, Object>{
                'userId' => u.Id,
                'userName' => u.Name,
                'department' => u.department__c,
                'role' => u.UserRole?.Name,
                'managerResponse' => managerResponseMap.get(u.Id),
                'hasManagerResponse' => managerResponseMap.containsKey(u.Id),
                'hasSubmitted' => userQuestionResponseMap.containsKey(u.Id)
            };
            
            List<Map<String, String>> questionResponses = new List<Map<String, String>>();
            for (Feedback_Question__c q : questions) {
                String answer = '';
                Boolean hasResponse = false;
                
                if (userQuestionResponseMap.containsKey(u.Id) && 
                    userQuestionResponseMap.get(u.Id).containsKey(q.Id)) {
                    String storedAnswer = userQuestionResponseMap.get(u.Id).get(q.Id);
                    answer = decodeResponse(storedAnswer, q.Input_Type__c, false);
                    hasResponse = true;
                }
                
                questionResponses.add(new Map<String, String>{
                    'questionId' => q.Id,
                    'answer' => answer,
                    'hasResponse' => String.valueOf(hasResponse)
                });
            }
            
            userData.put('questionResponses', questionResponses);
            userResponses.add(userData);
        }
        
        return userResponses;
    }
}