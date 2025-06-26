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
    // Base query
    String query = 'SELECT Id, Title__c, department__c, Applicable_Month__c, Active_Flag__c FROM Feedback_Form__c WHERE ';
    
    // Add conditions based on parameters
    List<String> conditions = new List<String>();
    List<Object> params = new List<Object>();
    
    // Department filter
    if (department != null && department != 'All') {
        conditions.add('department__c = :param' + params.size());
        params.add(department);
    }
    
    // Month filter
    if (month != null && month > 0) {
        conditions.add('CALENDAR_MONTH(Applicable_Month__c) = :param' + params.size());
        params.add(month);
    }
    
    // Year filter
    if (year != null && year > 0) {
        conditions.add('CALENDAR_YEAR(Applicable_Month__c) = :param' + params.size());
        params.add(year);
    }
    
    // If no conditions, get forms from the last 12 months
    if (conditions.isEmpty()) {
        Date twelveMonthsAgo = System.today().addMonths(-12);
        conditions.add('Applicable_Month__c >= :param' + params.size());
        params.add(twelveMonthsAgo);
    }
    
    // Add conditions to query
    query += String.join(conditions, ' AND ');
    query += ' ORDER BY Applicable_Month__c DESC';
    
    // Execute dynamic query with parameters
    List<Feedback_Form__c> forms = new List<Feedback_Form__c>();
    
    // Bind parameters and execute
    for (Integer i = 0; i < params.size(); i++) {
        query = query.replace(':param' + i, ':p' + i);
    }
    
    // Create a map for binding
    Map<String, Object> bindMap = new Map<String, Object>();
    for (Integer i = 0; i < params.size(); i++) {
        bindMap.put('p' + i, params[i]);
    }
    
    forms = Database.queryWithBinds(query, bindMap, AccessLevel.USER_MODE);
    
    return forms;
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