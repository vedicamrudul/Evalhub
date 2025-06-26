global class MonthlyFormActivatior implements Schedulable {
    global void execute(SchedulableContext sc) {
        Date currentMonthStart = Date.today().toStartOfMonth();

        // All forms for the current month
        List<Feedback_Form__c> thisMonthForms = [
            SELECT Id, Department__c 
            FROM Feedback_Form__c 
            WHERE Applicable_Month__c = :currentMonthStart
        ];

        // Map of department to current month form ID
        Map<String, Id> deptToFormId = new Map<String, Id>();
        for (Feedback_Form__c form : thisMonthForms) {
            deptToFormId.put(form.Department__c, form.Id);
        }

        // Fetch all forms (any month) for all departments that exist in the system
        Set<String> allDepartments = new Set<String>();
        for (Feedback_Form__c form : [
            SELECT Department__c FROM Feedback_Form__c WHERE Department__c != null
        ]) {
            allDepartments.add(form.Department__c);
        }

        // Now get all forms for all known departments
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

/*

2. Schedule It from Developer Console Once
Go to Developer Console → Debug → Open Execute Anonymous Window, then run:


String cronExp = '0 0 0 1 * ?'; // Midnight on the 1st of every month
System.schedule('Monthly Form Activator', cronExp, new MonthlyFormActivator());

⏰ Cron Explanation
0 0 0 1 * ? means:

0 0 0 = 12:00 AM

1 = day of month (1st)

* = every month

? = ignore day-of-week


*/