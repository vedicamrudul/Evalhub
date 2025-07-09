public with sharing class QuestionsController {
    
    // ==================== INNER CLASSES ====================
    
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
    
    // ==================== UTILITY METHODS ====================
    
    private static User validateCurrentUser() {
        User currentUser = UserController.getCurrentUser();
        if (currentUser == null || !currentUser.IsActive) {
            throw new AuraHandledException('User is not active or does not exist.');
        }
        return currentUser;
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
    
    private static List<Feedback_Question__c> getQuestionsByFormId(Id formId) {
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
    
    // ==================== RESPONSE DECODING METHODS ====================
    
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
    
    // Consolidated decode method that handles both emoji and rating types for both views
    public static String decodeResponse(String storedResponse, String questionType, Boolean isEmployeeView) {
        if (String.isBlank(storedResponse)) {
            return '';
        }
        
        // Handle emoji responses
        if (questionType == 'Emoji' && storedResponse.startsWith('emoji//')) {
            return decodeEmojiResponse(storedResponse, isEmployeeView);
        }
        
        // Handle rating responses
        if (questionType == 'Rating') {
            return decodeRatingResponse(storedResponse, isEmployeeView);
        }
        
        // Return as-is for other types
        return storedResponse;
    }
    
    private static String decodeEmojiResponse(String storedResponse, Boolean isEmployeeView) {
        List<String> parts = storedResponse.split('//');
        if (parts.size() != 3) {
            return storedResponse; // Backwards compatibility
        }
        
        String scaleGroup = parts[1];
        String label = parts[2];
        
        List<Input_Scale_Config__mdt> configs = queryEmojiConfig(scaleGroup, label);
        
        if (configs.isEmpty()) {
            return storedResponse; // Backwards compatibility
        }
        
        Input_Scale_Config__mdt config = configs[0];
        return isEmployeeView ? 
            config.Value_Stored__c + ' (' + config.Display_Label__c + ')' : 
            config.Display_Label__c;
    }
    
    private static List<Input_Scale_Config__mdt> queryEmojiConfig(String scaleGroup, String label) {
        // Try matching by Label field first
        List<Input_Scale_Config__mdt> configs = [
            SELECT Value_Stored__c, Display_Label__c, Label
            FROM Input_Scale_Config__mdt
            WHERE Active__c = true
            AND Input_Type__c = 'emoji'
            AND Scale_Group__c = :scaleGroup
            AND Label = :label
            LIMIT 1
        ];
        
        // If not found, try matching by Display_Label__c field
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
        
        // Check if it's metadata reference format: rating//scaleGroup//value
        if (storedResponse.startsWith('rating//')) {
            List<String> parts = storedResponse.split('//');
            if (parts.size() == 3) {
                scaleGroup = parts[1];
                try {
                    ratingValue = Integer.valueOf(parts[2]);
                } catch (Exception e) {
                    return storedResponse; // Backwards compatibility
                }
            }
        } else {
            // Backwards compatibility: if it's just a number
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
            String icon = '⭐'; // Default icon
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
    
    // ==================== QUESTION DATA BUILDING METHODS ====================
    
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
    
    // ==================== MAIN PUBLIC METHODS ====================
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getFeedbackData() {
        User currentUser = validateCurrentUser();
        
        Feedback_Form__c form = getActiveFormByDepartment(currentUser.department__c);
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
        
        Map<Id, Feedback_Response__c> responseMap = getResponseMapForUser(formQuestions, currentUser.Id);
        
        List<Map<String, Object>> questions = new List<Map<String, Object>>();
        for (Feedback_Question__c question : formQuestions) {
            String answer = '';
            Boolean hasResponse = false;
            
            if (responseMap.containsKey(question.Id)) {
                answer = responseMap.get(question.Id).Rating_Answer__c;
                hasResponse = true;
            }
            
            questions.add(buildQuestionData(question, answer, hasResponse, true));
        }
        
        String managerResponseText = getManagerResponseText(currentUser.Id, form.Id);
        
        response.put('managerResponseText', managerResponseText);
        response.put('hasManagerSubmitted', String.isNotBlank(managerResponseText));
        response.put('questions', questions);
        response.put('hasSubmitted', !responseMap.isEmpty());
        
        return response;
    }
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getEmployeeResponseForManager(Id employeeId) {
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
            
            questions.add(buildQuestionData(question, answer, hasResponse, false));
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
        
        List<User> allUsers = [
            SELECT Id, Name, department__c, UserRole.Name
            FROM User
            WHERE Id != :UserInfo.getUserId()
            AND department__c = :form.Department__c
        ];
        
        Map<String, Object> result = buildAdminResponseData(form, questions, allUsers);
        return result;
    }
    
    private static Map<String, Object> buildAdminResponseData(Feedback_Form__c form, List<Feedback_Question__c> questions, List<User> allUsers) {
        Map<String, Object> result = new Map<String, Object>();
        
        // Prepare questions structure
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
        result.put('formDepartment', form.Department__c);
        
        // Get all responses and manager responses
        Map<Id, Map<Id, String>> userQuestionResponseMap = getUserQuestionResponseMap(questions, allUsers);
        Map<Id, String> managerResponseMap = getManagerResponseMap(allUsers, form.Id);
        
        // Build user responses
        List<Map<String, Object>> userResponses = buildUserResponsesList(allUsers, questions, userQuestionResponseMap, managerResponseMap);
        result.put('userResponses', userResponses);
        
        return result;
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
            // Skip system users
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
            
            // Add responses for each question
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