public with sharing class FormController {
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
        
        @AuraEnabled
        public String scaleGroup { get; set; }
        
        @AuraEnabled
        public String picklistType { get; set; }
    }

    @AuraEnabled
    public static String createForm(FeedbackFormWrapper formWrapper, List<FeedbackQuestionWrapper> questionWrappers) {
        Feedback_Form__c form = new Feedback_Form__c();
        form.Title__c = formWrapper.title;
        form.department__c = formWrapper.department;
        form.Active_Flag__c = false;
        form.Applicable_Month__c = formWrapper.applicableMonth;
        
        try{
            insert form;
        } catch (DmlException e) {
            throw new AuraHandledException('Error creating form: ' + e.getMessage());
        }

        List<Feedback_Question__c> questions = new List<Feedback_Question__c>();
        for (FeedbackQuestionWrapper question : questionWrappers) {
            Feedback_Question__c q = new Feedback_Question__c();
            q.Feedback_Form__c = form.Id;
            q.Question_Text__c = question.questionText;
            q.Input_Type__c = question.inputType;
            
            if (question.inputType == 'Picklist') {
                if (question.picklistType == 'Custom') {
                    q.Picklist_Values__c = question.picklistValues;
                } else {
                    q.Picklist_Values__c = question.picklistType;
                }
            } else if (question.inputType == 'Slider') {
                q.Picklist_Values__c = 'Slider_1_to_10';
            } else if (question.inputType == 'Emoji') {
                q.Picklist_Values__c = String.isNotBlank(question.scaleGroup) ? question.scaleGroup : 'Satisfaction_Emojis';
            } else if (question.inputType == 'Rating') {
                q.Picklist_Values__c = String.isNotBlank(question.scaleGroup) ? question.scaleGroup : 'Star_Config';
            } else if (question.scaleGroup != null) {
                q.Picklist_Values__c = question.scaleGroup;
            }
            
            questions.add(q);
        }
        
        if (!questions.isEmpty()) {
            try{
                insert questions;
            }catch (DmlException e) {
                throw new AuraHandledException('Error creating questions: ' + e.getMessage());
            }
        }

        return form.Id;
    }

    @AuraEnabled(cacheable=true)
    public static List<Feedback_Form__c> getAllForms() {
        Date twelveMonthsAgo = System.today().addMonths(-12);
        
        return [
            SELECT Id, Title__c, department__c, Applicable_Month__c, Active_Flag__c
            FROM Feedback_Form__c
            WHERE Applicable_Month__c >= :twelveMonthsAgo
            ORDER BY Applicable_Month__c DESC
        ];
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

        if (conditions.isEmpty()) {
            conditions.add('Applicable_Month__c >= :p' + index);
            bindMap.put('p' + index, System.today().addMonths(-12));
        }

        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }

        query += ' ORDER BY Applicable_Month__c DESC';

        return Database.queryWithBinds(query, bindMap, AccessLevel.USER_MODE);
    }

    @AuraEnabled(cacheable=true)
    public static List<Feedback_question__c> getQuestions(Id formId){
        return [SELECT Id, Question_Text__c, Input_Type__c, Picklist_Values__c
                FROM Feedback_Question__c
                WHERE Feedback_Form__c = :formId
                ORDER BY CreatedDate ASC];
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getInputTypesFromMetadata() {
        Map<String, Object> result = new Map<String, Object>();
        
        List<Input_Scale_Config__mdt> configs = [
            SELECT Label, Input_Type__c, Scale_Group__c, Display_Label__c, Value_Stored__c, Order__c
            FROM Input_Scale_Config__mdt
            WHERE Active__c = true
            ORDER BY Input_Type__c, Order__c
        ];
        
        Map<String, List<Map<String, Object>>> groupedConfigs = new Map<String, List<Map<String, Object>>>();
        Set<String> inputTypes = new Set<String>();
        
        for (Input_Scale_Config__mdt config : configs) {
            String inputType = config.Input_Type__c;
            inputTypes.add(inputType);

            if (!groupedConfigs.containsKey(inputType)) {
                groupedConfigs.put(inputType, new List<Map<String, Object>>());
            }
            
            groupedConfigs.get(inputType).add(new Map<String, Object>{
                'label' => config.Label,
                'scaleGroup' => config.Scale_Group__c,
                'displayLabel' => config.Display_Label__c,
                'valueStored' => config.Value_Stored__c,
                'order' => config.Order__c
            });
        }
        
        List<Map<String, String>> inputTypeOptions = new List<Map<String, String>>();
        inputTypeOptions.add(new Map<String, String>{'label' => 'Text', 'value' => 'Text'});
        // inputTypeOptions.add(new Map<String, String>{'label' => 'Slider', 'value' => 'Slider'});
        
        for (String inputType : inputTypes) {
            String label = inputType.substring(0, 1).toUpperCase() + inputType.substring(1);
            inputTypeOptions.add(new Map<String, String>{'label' => label, 'value' => inputType});
        }
        
        List<Map<String, String>> picklistGroups = new List<Map<String, String>>();
        picklistGroups.add(new Map<String, String>{'label' => 'Custom', 'value' => 'Custom'});
        
        Set<String> picklistGroupSet = new Set<String>();
        for (Input_Scale_Config__mdt config : configs) {
            if (config.Input_Type__c == 'picklist') {
                picklistGroupSet.add(config.Scale_Group__c);
            }
        }
        
        for (String picklistGroup : picklistGroupSet) {
            String label = picklistGroup.replace('_', ' ');
            picklistGroups.add(new Map<String, String>{'label' => label, 'value' => picklistGroup});
        }
        
        result.put('inputTypeOptions', inputTypeOptions);
        result.put('scaleConfigurations', groupedConfigs);
        result.put('picklistGroups', picklistGroups);
        
        return result;
    }
}