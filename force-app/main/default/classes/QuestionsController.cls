public with sharing class QuestionsController {


  public class QuestionAnswerPair {
    @AuraEnabled
    public String questionId { get; set; } // Must match JS exactly (case-sensitive)

    @AuraEnabled
    public String answer { get; set; } // Must match JS exactly
}

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
    
    response.put('questions', questions);
    response.put('hasSubmitted', !responses.isEmpty());
    
    return response;
}
//    @AuraEnabled(cacheable=true)
// public static Map<String, Object> getFeedbackData() {
//     // Get current user
//     User currentUser = UserController.getCurrentUser();
//     if (currentUser == null || !currentUser.IsActive) {
//         throw new AuraHandledException('User is not active or does not exist.');
//     }
    
//     // Get active form for user's department
//     Feedback_Form__c form = [
//         SELECT Id 
//         FROM Feedback_Form__c 
//         WHERE Active_Flag__c = true 
//         AND department__c = :currentUser.department__c 
//         LIMIT 1
//     ];
//     if (form == null) {
//         throw new AuraHandledException('No active form found for the user\'s department.');
//     }

//     // Get all questions for this form
//     List<Feedback_Question__c> formQuestions = [
//         SELECT Id, Question_Text__c, Input_Type__c, Picklist_Values__c, Feedback_Form__c
//         FROM Feedback_Question__c 
//         WHERE Feedback_Form__c = :form.Id
//     ];
//     if (formQuestions.isEmpty()) {
//         throw new AuraHandledException('No questions found for the active form.');
//     }

//     // Prepare response structure
//     Map<String, Object> response = new Map<String, Object>();
//     List<Map<String, Object>> questions = new List<Map<String, Object>>();
    
//     // Get all responses for these questions from this user (if any exist)
//     List<Feedback_Response__c> responses = [
//         SELECT Id, Question_Lookup__c, Rating_Answer__c
//         FROM Feedback_Response__c
//         WHERE Responder__c = :currentUser.Id
//         AND Respondent__c = :currentUser.Id
//         AND Question_Lookup__c IN :formQuestions
//     ];
    
//     // Create map of questionId to response for quick lookup
//     Map<Id, Feedback_Response__c> responseMap = new Map<Id, Feedback_Response__c>();
//     for (Feedback_Response__c res : responses) {
//         responseMap.put(res.Question_Lookup__c, res);
//     }
    
//     // Prepare question data with answers if they exist
//     for (Feedback_Question__c question : formQuestions) {
//         Map<String, Object> qData = new Map<String, Object>{
//             'id' => question.Id,
//             'questionText' => question.Question_Text__c,
//             'inputType' => question.Input_Type__c,
//             'picklistValues' => question.Picklist_Values__c
//         };
        
//         if (responseMap.containsKey(question.Id)) {
//             qData.put('answer', responseMap.get(question.Id).Rating_Answer__c);
//             qData.put('hasResponse', true);
//         } else {
//             qData.put('hasResponse', false);
//         }
        
//         questions.add(qData);
//     }
    
//     response.put('questions', questions);
//     response.put('hasSubmitted', !responses.isEmpty());
    
//     return response;
// }


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