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
    try{
    insert form;
    } catch (DmlException e) {
        // Handle any errors that occur during the insert operation
        throw new AuraHandledException('Error creating form: ' + e.getMessage());
    }

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
        try{
            insert questions;
        }catch (DmlException e) {
            // Handle any errors that occur during the insert operation
            throw new AuraHandledException('Error creating questions: ' + e.getMessage());
        }
    }

    return form.Id; // Return the ID of the created form to the frontend so it can be used to associate the question responses with the form
}

// there are two things to do now. One method is to get all the forms and another is to get the questions for a specific form => for admin view.

// function to get all forms in the past 12 months 

@AuraEnabled(cacheable=true)
public static List<Feedback_Form__c> getAllForms() {
    Date twelveMonthsAgo = System.today().addMonths(-12);
    
    // Query to get all forms created in the last 12 months
    List<Feedback_Form__c> forms = [
        SELECT Id, Title__c, department__c, Applicable_Month__c, Active_Flag__c
        FROM Feedback_Form__c
        WHERE Applicable_Month__c >= :twelveMonthsAgo
        ORDER BY Applicable_Month__c DESC
    ];
    
    return forms;
}

@AuraEnabled(cacheable=true)
public static List<Feedback_Form__c> getFilteredForms(String department, Integer month, Integer year) {
    String query = 'SELECT Id, Title__c, department__c, Applicable_Month__c, Active_Flag__c FROM Feedback_Form__c';
    
    List<String> conditions = new List<String>();
    Map<String, Object> bindMap = new Map<String, Object>();
    Integer index = 0;

    if (department != null && department != 'All') {
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

    // Default: last 12 months
    if (conditions.isEmpty()) {
        conditions.add('Applicable_Month__c >= :p' + index);
        bindMap.put('p' + index, System.today().addMonths(-12));
    }

    // Final query string
    if (!conditions.isEmpty()) {
        query += ' WHERE ' + String.join(conditions, ' AND ');
    }

    query += ' ORDER BY Applicable_Month__c DESC';

    // Execute dynamic query
    return Database.queryWithBinds(query, bindMap, AccessLevel.USER_MODE);
}


// ------------------------------------------------------------------------------------
// FUNCTION TO GET QUESTIONS FOR A SPECIFIC FORM
// ------------------------------------------------------------------------------------

@AuraEnabled(cacheable=true)
public static List<Feedback_question__c> getQuestions(Id formId){
 
    List<Feedback_question__c> questions = [SELECT Id, Question_Text__c, Input_Type__c, Picklist_Values__c
                                            FROM Feedback_Question__c
                                            WHERE Feedback_Form__c = :formId
                                            ORDER BY CreatedDate ASC];
                                            
    return questions;
}

}