public with sharing class QuestionsController {
  public class QuestionAnswerPair {
    @AuraEnabled
    public String questionId { get; set; } // Must match JS exactly (case-sensitive)

    @AuraEnabled
    public String answer { get; set; } // Must match JS exactly
}

 public class ManagerResponse{
    @AuraEnabled
    public String managerResponseText { get; set; } // Must match JS exactly (case-sensitive)

    @AuraEnabled
    public String employeeId { get; set; } // Must match JS exactly
 }
 // --------------------------------------------------------------------------------------

//  BELOW IS FUNCTION TO GET FEEDBACK DATA FOR EMPLOYEE/EXECUTIVE
//  --------------------------------------------------------------------------------------
   @AuraEnabled(cacheable=true)
   public static Map<String, Object> getFeedbackData() {
    // Get current user
    User currentUser = UserController.getCurrentUser();
    if (currentUser == null || !currentUser.IsActive) {
        throw new AuraHandledException('User is not active or does not exist.');
    }
    
    // Get active form for user's department
    Feedback_Form__c form = [
        SELECT Id 
        FROM Feedback_Form__c 
        WHERE Active_Flag__c = true 
        AND department__c = :currentUser.department__c 
        LIMIT 1
    ];
    if (form == null) {
        throw new AuraHandledException('No active form found for the user\'s department.');
    }

    // Get all questions for this form
    List<Feedback_Question__c> formQuestions = [
        SELECT Id, Question_Text__c, Input_Type__c, Picklist_Values__c, Feedback_Form__c
        FROM Feedback_Question__c 
        WHERE Feedback_Form__c = :form.Id
    ];
    if (formQuestions.isEmpty()) {
        throw new AuraHandledException('No questions found for the active form.');
    }

    // Prepare response structure
    Map<String, Object> response = new Map<String, Object>();
    List<Map<String, Object>> questions = new List<Map<String, Object>>();
    
    // Get all responses for these questions from this user (if any exist)
    List<Feedback_Response__c> responses = [
        SELECT Id, Question_Lookup__c, Rating_Answer__c
        FROM Feedback_Response__c
        WHERE Responder__c = :currentUser.Id
        AND Respondent__c = :currentUser.Id
        AND Question_Lookup__c IN :formQuestions
    ];
    
    // Create map of questionId to response for quick lookup
    Map<Id, Feedback_Response__c> responseMap = new Map<Id, Feedback_Response__c>();
    for (Feedback_Response__c res : responses) {
        responseMap.put(res.Question_Lookup__c, res);
    }
    
    // Prepare question data with answers if they exist
    for (Feedback_Question__c question : formQuestions) {
        Map<String, Object> qData = new Map<String, Object>{
            'id' => question.Id,
            'questionText' => question.Question_Text__c,
            'inputType' => question.Input_Type__c,
            'picklistValues' => question.Picklist_Values__c
        };
        
        if (responseMap.containsKey(question.Id)) {
            qData.put('answer', responseMap.get(question.Id).Rating_Answer__c);
            qData.put('hasResponse', true);
        } else {
            qData.put('hasResponse', false);
        }
        
        questions.add(qData);
    }

    // lets get manager's response for this user for this form. 


    List<Manager_Response__c> managerResponses = [
        SELECT Id, Manager_Response_Test__c
        FROM Manager_Response__c 
        WHERE User_Lookup__c = :currentUser.Id
        AND Feedback_Form_Lookup__c = :form.Id
        LIMIT 1
    ];


    response.put('managerResponseText', managerResponses.isEmpty() ? '' : managerResponses[0].Manager_Response_Test__c);
    response.put('hasManagerSubmitted', !managerResponses.isEmpty());
    response.put('questions', questions);
    response.put('hasSubmitted', !responses.isEmpty());
    
    return response;
}

// form data for admin to upload


// ----------------------------------------------------------------------------------------
// FUNTCTION TO GET EMPLOYEE FEEDBACK RESPONSE FOR MANAGER
// ----------------------------------------------------------------------------------------
@AuraEnabled(cacheable=true)
public static Map<String, Object> getEmployeeResponseForManager(Id employeeId){
    // Get current user
    User currentUser = UserController.getCurrentUser();
    if (currentUser == null || !currentUser.IsActive) {
        throw new AuraHandledException('User is not active or does not exist.');
    }

    System.debug('employeeId: ' + employeeId);

    // get department of employee
    if (employeeId == null) {
        throw new AuraHandledException('Employee ID cannot be null.');
    }
    User employee = [
        SELECT  department__c 
        FROM User 
        WHERE Id = :employeeId 
        LIMIT 1
    ];
    System.debug('Current User: ' + currentUser);
    // Get active form for manager's department, get questions for the form and employee and manager both responses
    // we will return hasEmployeeSubmitted and hasManagerSubmitted flags
    Feedback_Form__c form = [
        SELECT Id
        FROM Feedback_Form__c 
        WHERE Active_Flag__c = true
        AND department__c = :employee.department__c
        LIMIT 1
    ];

    if (form == null) {
        throw new AuraHandledException('No active form found for the user\'s department.');
    }

    // Get all questions for this form
    List<Feedback_Question__c> formQuestions = [
        SELECT Id, Question_Text__c, Input_Type__c, Picklist_Values__c, Feedback_Form__c
        FROM Feedback_Question__c
        WHERE Feedback_Form__c = :form.Id
    ];

    if (formQuestions.isEmpty()) {
        throw new AuraHandledException('No questions found for the active form.');
    }
    // Prepare response structure
    // so for employee we get response from feedback response object but the manager response will be for one form directly in a new object manager response object Fields & Relationships
// Feedback Form Lookup	Feedback_Form_Lookup__c	Lookup(Feedback Form)	
// Manager Response Test	Manager_Response_Test__c	Long Text Area(500)		False	
// ManagerResponse Name	Name	Auto Number		True		
// User Lookup	User_Lookup__c

    Map<String, Object> response = new Map<String, Object>();
    List<Map<String, Object>> questions = new List<Map<String, Object>>();
    
    // Get all responses for these questions from the employee
    List<Feedback_Response__c> employeeResponses = [
        SELECT Id, Question_Lookup__c, Rating_Answer__c
        FROM Feedback_Response__c
        WHERE Responder__c = :employeeId
        AND Respondent__c = :employeeId
        AND Question_Lookup__c IN :formQuestions
    ];

    system.debug('Form Questions: ' + formQuestions);
    system.debug('Form ID: ' + form.Id);
    system.debug('Employee ID: ' + employeeId);
    system.debug('Employee Responses: ' + employeeResponses);
    
    // Create map of questionId to response for quick lookup
    Map<Id, Feedback_Response__c> employeeResponseMap = new Map<Id, Feedback_Response__c>();
    for (Feedback_Response__c res : employeeResponses) {
        employeeResponseMap.put(res.Question_Lookup__c, res);
    }
    
    // Prepare question data with answers if they exist
    for (Feedback_Question__c question : formQuestions) {
        Map<String, Object> qData = new Map<String, Object>{
            'id' => question.Id,
            'questionText' => question.Question_Text__c,
            'inputType' => question.Input_Type__c,
            'picklistValues' => question.Picklist_Values__c
        };
        
        if (employeeResponseMap.containsKey(question.Id)) {
            qData.put('answer', employeeResponseMap.get(question.Id).Rating_Answer__c);
            qData.put('hasResponse', true);
        } else {
            qData.put('hasResponse', false);
        }
        
        questions.add(qData);
    }
    
    response.put('questions', questions);
    
    // Check if employee has submitted feedback
    response.put('hasEmployeeSubmitted', !employeeResponses.isEmpty());
    
    // Check if manager has submitted feedback for this employee
    List<Manager_Response__c> managerResponses = [
        SELECT Id, Manager_Response_Test__c
        FROM Manager_Response__c 
        WHERE User_Lookup__c = :employeeId
        AND Feedback_Form_Lookup__c = :form.Id 
        LIMIT 1
    ];
    
    System.debug('Manager Responses: ' + managerResponses);
    response.put('hasManagerSubmitted', !managerResponses.isEmpty());
    response.put('managerResponseText', managerResponses.isEmpty() ? '' : managerResponses[0].Manager_Response_Test__c);
    response.put('managerResponseText', managerResponses.isEmpty() ? '' : managerResponses[0].Manager_Response_Test__c);
    System.debug('response: ' + response);
    return response;

}


// --------------------------------------------------------------------------------------
// FUNCTIONS FOR MANAGER TO SUBMIT RESPONSE
// --------------------------------------------------------------------------------------
@AuraEnabled
public static String submitManagerResponse(ManagerResponse response) {
    // lets first get the user id thats active for responder
    User currentUser = UserController.getCurrentUser();
    if (currentUser == null || !currentUser.IsActive) {
        throw new AuraHandledException('User is not active or does not exist.');
    }
    if (response == null || String.isBlank(response.managerResponseText) || String.isBlank(response.employeeId)) {
        throw new AuraHandledException('Manager response text and employee ID cannot be blank.');
    }

    // get department of employee
    User employee = [
        SELECT department__c
        FROM User 
        WHERE Id = :response.employeeId
        LIMIT 1
    ];

    // we have response object we need to create manager response object and then insert it in the Manager_Response__c object
    Manager_Response__c managerResponse = new Manager_Response__c(
        Manager_Response_Test__c = response.managerResponseText,
        User_Lookup__c = response.employeeId,
        Feedback_Form_Lookup__c = [
            SELECT Id
            FROM Feedback_Form__c 
            WHERE Active_Flag__c = true
            AND department__c = :employee.department__c
            LIMIT 1
        ].Id

    );

    try {
        insert managerResponse;
    } catch (Exception e) {
        throw new AuraHandledException('Error submitting manager response: ' + e.getMessage());
    }
    return 'Manager response submitted successfully.';

}

//  --------------------------------------------------------------------------------------
// FUNCTION TO SUBMIT FEEDBACK RESPONSE BY EMPLOYEE OR EXECUTIVE
//  --------------------------------------------------------------------------------------
    @AuraEnabled
    public static String submitFeedback(List<QuestionAnswerPair> answers, Id respondentId) {

    // lets first get the user id thats active for responder
        User currentUser= UserController.getCurrentUser();
        if (currentUser == null || !currentUser.IsActive) {
            throw new AuraHandledException('User is not active or does not exist.');
        }

        if (answers == null || answers.isEmpty()) {
            throw new AuraHandledException('No answers provided.');
        }

        // we have answers ka list we need to loop through it and create feedback response object for each answer and then insert it in the Feedback_Response__c object
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

            try{
                // Insert all responses in a single DML operation
            insert responsesToInsert;
               return 'Feedback submitted successfully.';
            } catch (DmlException e) {
              return 'Error submitting feedback: ' + e.getMessage();
            }
    }

// use the same function - getEmployeeResponseForManager(Id employeeId) to get the feedback for the user for admin.

// function to get the questions for the form and the response for all users other than admin with user information like name and department and role for admin
@AuraEnabled(cacheable=true)
public static Map<String, Object> getAllUserResponsesForAdmin(Id formId) {
    // Get current admin user
    User currentUser = UserController.getCurrentUser();
    if (currentUser == null) {
        throw new AuraHandledException('User not found');
    }

    // Get the form details
    Feedback_Form__c form = [
        SELECT Id, Name, Department__c 
        FROM Feedback_Form__c 
        WHERE Id = :formId
        LIMIT 1
    ];

    if (form == null) {
        throw new AuraHandledException('Form not found');
    }

    // Get all questions for this form
    List<Feedback_Question__c> questions = [
        SELECT Id, Question_Text__c, Input_Type__c, Picklist_Values__c
        FROM Feedback_Question__c
        WHERE Feedback_Form__c = :formId
        ORDER BY CreatedDate
    ];

    // Get only custom users (not Salesforce system users) except admin
    // Filter for users in the same department as the form, if form has a department
    String formDepartment = form.Department__c;
    
    List<User> allUsers = [
        SELECT Id, Name, Department, UserRole.Name
        FROM User
        WHERE Id != :currentUser.Id
       AND department__c = :formDepartment
    ];

    // Get all responses for these questions from all users
    List<Feedback_Response__c> allResponses = [
        SELECT Id, Question_Lookup__c, Rating_Answer__c, 
               Responder__c, Responder__r.Name, Respondent__c, Respondent__r.Name
        FROM Feedback_Response__c
        WHERE Question_Lookup__c IN :questions
        AND Respondent__c IN :allUsers
        ORDER BY Respondent__r.Name, Question_Lookup__c
    ];

    // Get all manager responses for these users
    List<Manager_Response__c> managerResponses = [
        SELECT Id, Manager_Response_Test__c, User_Lookup__c, User_Lookup__r.Name
        FROM Manager_Response__c
        WHERE User_Lookup__c IN :allUsers
        AND Feedback_Form_Lookup__c = :formId
    ];

    // Organize data for response
    Map<String, Object> result = new Map<String, Object>();
    
    // 1. Prepare questions structure
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
    result.put('formDepartment', form.Department__c);

    // 2. Prepare user responses structure
    List<Map<String, Object>> userResponses = new List<Map<String, Object>>();
    
    // Create map for quick lookup of responses by user and question
    Map<Id, Map<Id, String>> userQuestionResponseMap = new Map<Id, Map<Id, String>>();
    for (Feedback_Response__c res : allResponses) {
        if (!userQuestionResponseMap.containsKey(res.Respondent__c)) {
            userQuestionResponseMap.put(res.Respondent__c, new Map<Id, String>());
        }
        userQuestionResponseMap.get(res.Respondent__c).put(res.Question_Lookup__c, res.Rating_Answer__c);
    }

    // Create map for manager responses by user
    Map<Id, String> managerResponseMap = new Map<Id, String>();
    for (Manager_Response__c mr : managerResponses) {
        managerResponseMap.put(mr.User_Lookup__c, mr.Manager_Response_Test__c);
    }

    // Build final user response structure
    for (User u : allUsers) {
        // Skip system users or users without proper data
        if (u.Department == null || u.Name == null || u.Name.contains('Automated Process') || u.Name.contains('Integration User')) {
            continue;
        }
        
        Map<String, Object> userData = new Map<String, Object>{
            'userId' => u.Id,
            'userName' => u.Name,
            'department' => u.Department,
            'role' => u.UserRole?.Name,
            'managerResponse' => managerResponseMap.containsKey(u.Id) ? managerResponseMap.get(u.Id) : null,
            'hasManagerResponse' => managerResponseMap.containsKey(u.Id)
        };

        // Add responses for each question
        List<Map<String, String>> questionResponses = new List<Map<String, String>>();
        for (Feedback_Question__c q : questions) {
            String answer = '';
            Boolean hasResponse = false;
            
            if (userQuestionResponseMap.containsKey(u.Id) && 
                userQuestionResponseMap.get(u.Id).containsKey(q.Id)) {
                answer = userQuestionResponseMap.get(u.Id).get(q.Id);
                hasResponse = true;
            }
            
            questionResponses.add(new Map<String, String>{
                'questionId' => q.Id,
                'answer' => answer,
                'hasResponse' => String.valueOf(hasResponse)
            });
        }
        
        userData.put('questionResponses', questionResponses);
        userData.put('hasSubmitted', userQuestionResponseMap.containsKey(u.Id));
        userResponses.add(userData);
    }

    result.put('userResponses', userResponses);
    System.debug('Returning ' + userResponses.size() + ' custom users out of ' + allUsers.size() + ' total users for form: ' + form.Name);
    return result;
}
                    
}