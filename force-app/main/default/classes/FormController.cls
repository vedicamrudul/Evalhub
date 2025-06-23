public with sharing class FormController {
    // only below for posting request not get request
    public class FeedbackFormWrapper {
    @AuraEnabled
    public String title { get; set; }
    
    @AuraEnabled
    public String department { get; set; }
    
    @AuraEnabled
    public Date applicableMonth { get; set; }
}

public class FeedbackQuestionWrapper {
    @AuraEnabled
    public String formId { get; set; }

    @AuraEnabled
    public String questionText { get; set; }
    
    @AuraEnabled
    public String inputType { get; set; }
    
    @AuraEnabled
    public String picklistValues { get; set; }
}

// create form with questions

@AuraEnabled
public static String createForm(FeedbackFormWrapper formWrapper, List<FeedbackQuestionWrapper> questionWrappers) {
    // Create the form record
    Feedback_Form__c form = new Feedback_Form__c();
    form.Title__c = formWrapper.title;
    form.Department__c = formWrapper.department;
    form.Active_Flag__c = false;
    form.Applicable_Month__c = formWrapper.applicableMonth;
    insert form;

    // Create the questions associated with the form
    List<Feedback_Question__c> questions = new List<Feedback_Question__c>();
    for (FeedbackQuestionWrapper question : questionWrappers) {
        Feedback_Question__c q = new Feedback_Question__c();
        q.Feedback_Form__c = form.Id;
        q.Question_Text__c = question.questionText;
        q.Input_Type__c = question.inputType;
        q.Picklist_Values__c = question.picklistValues; //text field only
        questions.add(q);
    }
    
    if (!questions.isEmpty()) {
        insert questions;
    }

    return form.Id; // Return the ID of the created form to the frontend so it can be used to associate the question responses with the form
}

}