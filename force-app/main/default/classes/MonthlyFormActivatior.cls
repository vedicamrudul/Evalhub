global class MonthlyFormActivatior implements Schedulable {
    global void execute(SchedulableContext sc) {
        Date currentMonthStart = Date.today().toStartOfMonth();

        List<Feedback_Form__c> thisMonthForms = [
            SELECT Id, Department__c 
            FROM Feedback_Form__c 
            WHERE Applicable_Month__c = :currentMonthStart
        ];

        Map<String, Id> deptToFormId = new Map<String, Id>();
        for (Feedback_Form__c form : thisMonthForms) {
            deptToFormId.put(form.Department__c, form.Id);
        }

        Set<String> allDepartments = new Set<String>();
        for (Feedback_Form__c form : [
            SELECT Department__c FROM Feedback_Form__c WHERE Department__c != null
        ]) {
            allDepartments.add(form.Department__c);
        }

        List<Feedback_Form__c> allForms = [
            SELECT Id, Department__c, Applicable_Month__c, Active_Flag__c 
            FROM Feedback_Form__c 
            WHERE Department__c IN :allDepartments
        ];

        List<Feedback_Form__c> updates = new List<Feedback_Form__c>();

        for (Feedback_Form__c form : allForms) {
            Date formMonth = form.Applicable_Month__c != null ? form.Applicable_Month__c.toStartOfMonth() : null;
            Boolean shouldBeActive = (formMonth == currentMonthStart) &&
                                     (deptToFormId.get(form.Department__c) == form.Id);

            if (form.Active_Flag__c != shouldBeActive) {
                form.Active_Flag__c = shouldBeActive;
                updates.add(form);
            }
        }

        if (!updates.isEmpty()) {
            update updates;
        }
    }
}