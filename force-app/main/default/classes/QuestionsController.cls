public with sharing class QuestionsController {


  public class QuestionAnswerPair {
    @AuraEnabled
    public String questionId { get; set; } // Must match JS exactly (case-sensitive)

    @AuraEnabled
    public String answer { get; set; } // Must match JS exactly
}

    @AuraEnabled(cacheable=true)
    public static List<Feedback_Question__c> getQuestions() {
        // from below query, we get information about active user and his department. 
        User currentUser = UserController.getCurrentUser();
        if (currentUser == null || !currentUser.IsActive) {
            throw new AuraHandledException('User is not active or does not exist.');
        }
        
        // now we need to get form id which is active and department is same as user department only one
        Feedback_Form__c form = [
            SELECT Id, Name 
            FROM Feedback_Form__c 
            WHERE Active_Flag__c = true 
            AND department__c = :currentUser.department__c 
            LIMIT 1
        ];

        if (form == null) {
            throw new AuraHandledException('No active form found for the user\'s department.');
        }

        // now we need to get questions related to this form (that lookup to this form)
        List<Feedback_Question__c> formQuestions = [
            SELECT Id, Question_Text__c, Input_Type__c, Picklist_Values__c, Feedback_Form__c
            FROM Feedback_Question__c 
            WHERE Feedback_Form__c = :form.Id];

        if (formQuestions.isEmpty()) {
            throw new AuraHandledException('No questions found for the active form.');
        }
        return formQuestions;
    }

     @AuraEnabled(cacheable=true)
    public static Boolean hasExecutiveSubmittedFeedback(){
        // we will get current form id that is active for the user department and check the feedback response object to see if there is any response submitted by executive user
        User currentUser = UserController.getCurrentUser();
        if (currentUser == null || !currentUser.IsActive) {
            throw new AuraHandledException('User is not active or does not exist.');
        }
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
        // Use LIMIT 1 or get the first question from a list instead of assigning to a single SObject
        Feedback_Question__c question = [
            SELECT Id
            FROM Feedback_Question__c 
            WHERE Feedback_Form__c = :form.Id
            LIMIT 1
        ];
        // now we will check if there is any response submitted by executive user
        List<Feedback_Response__c> responses = [
            SELECT Id 
            FROM Feedback_Response__c 
            WHERE Question_Lookup__c = :question.Id 
            AND Responder__c = :currentUser.Id
            AND Respondent__c = :currentUser.Id
            LIMIT 1
        ];
        return !responses.isEmpty();
    }


//    get question and answers if user has submitted the feedback.
   @AuraEnabled(cacheable=true)
public static List<Map<String, Object>> getEmployeeSubmittedFeedback() {
    // lets first get the user id thats active for responder
    User currentUser = UserController.getCurrentUser();
    if (currentUser == null || !currentUser.IsActive) {
        throw new AuraHandledException('User is not active or does not exist.');
    }
    // now we need to get form id which is active and department is same as user department only one
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
    // now we need to get questions related to this form (that lookup to this form)
    List<Feedback_Question__c> formQuestions = [
        SELECT Id, Question_Text__c, Input_Type__c, Picklist_Values__c, Feedback_Form__c
        FROM Feedback_Question__c
        WHERE Feedback_Form__c = :form.Id
    ];
    if (formQuestions.isEmpty()) {
        throw new AuraHandledException('No questions found for the active form.');
    }
    
    // Create a map of question Id to question text for easy lookup
    Map<Id, Feedback_Question__c> questionMap = new Map<Id, Feedback_Question__c>(formQuestions);
    
    // now we need to get responses submitted by the user for these questions
    List<Feedback_Response__c> responses = [
        SELECT Id, Question_Lookup__c, Rating_Answer__c, Responder__c, Respondent__c
        FROM Feedback_Response__c
        WHERE Responder__c = :currentUser.Id
        AND Respondent__c = :currentUser.Id
        AND Question_Lookup__c IN :formQuestions
    ];
    if (responses.isEmpty()) {
        throw new AuraHandledException('No feedback responses found for the user.');
    }
    
    // Create a list of maps containing question text and answer
    List<Map<String, Object>> questionAnswers = new List<Map<String, Object>>();
    for (Feedback_Response__c response : responses) {
        Feedback_Question__c question = questionMap.get(response.Question_Lookup__c);
        if (question != null) {
            Map<String, Object> qa = new Map<String, Object>();
            qa.put('questionText', question.Question_Text__c);
            qa.put('answer', response.Rating_Answer__c);
            qa.put('inputType', question.Input_Type__c);
            // Add additional fields if needed
            questionAnswers.add(qa);
        }
    }
    
    // Return the list of question-answer pairs
    return questionAnswers;
}



    //function to submit feedback response.
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
}