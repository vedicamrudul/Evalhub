trigger FeedbackFormTrigger on Feedback_Form__c (before insert, after insert) {
    
    // Before Insert Logic - Validation and activation
    if (Trigger.isBefore && Trigger.isInsert) {
        Set<String> newKeys = new Set<String>();

        for (Feedback_Form__c form : Trigger.new) {
            if (form.Applicable_Month__c != null && form.Department__c != null) {
                String key = form.Applicable_Month__c.toStartOfMonth().format() + ':' + form.Department__c;
                newKeys.add(key);
            }
        }

        // Get existing forms with same month and department
        List<Feedback_Form__c> existingForms = [
            SELECT Id, Applicable_Month__c, Department__c, Active_Flag__c
            FROM Feedback_Form__c
            WHERE Applicable_Month__c != null AND Department__c != null
        ];

        Set<String> existingKeys = new Set<String>();
        for (Feedback_Form__c existing : existingForms) {
            String key = existing.Applicable_Month__c.toStartOfMonth().format() + ':' + existing.Department__c;
            existingKeys.add(key);
        }

        // To hold forms that need to be deactivated
        List<Feedback_Form__c> formsToDeactivate = new List<Feedback_Form__c>();

        for (Feedback_Form__c form : Trigger.new) {
            if (form.Applicable_Month__c != null && form.Department__c != null) {
                String key = form.Applicable_Month__c.toStartOfMonth().format() + ':' + form.Department__c;

                Boolean isDuplicate = existingKeys.contains(key) &&
                    (Trigger.isInsert || 
                     (Trigger.isUpdate &&
                      (Trigger.oldMap.get(form.Id).Applicable_Month__c != form.Applicable_Month__c || 
                       Trigger.oldMap.get(form.Id).Department__c != form.Department__c)));

                if (isDuplicate) {
                    form.addError('A form already exists for this department and month.');
                }

                // Activate if current month
                if (form.Applicable_Month__c.toStartOfMonth() == Date.today().toStartOfMonth()) {
                    form.Active_Flag__c = true;

                    // Find other active forms for the same dept and month and mark them inactive
                    for (Feedback_Form__c existing : existingForms) {
                        if (
                            existing.Applicable_Month__c.toStartOfMonth() == form.Applicable_Month__c.toStartOfMonth() &&
                            existing.Department__c == form.Department__c &&
                            existing.Id != form.Id &&
                            existing.Active_Flag__c == true
                        ) {
                            existing.Active_Flag__c = false;
                            formsToDeactivate.add(existing);
                        }
                    }

                } else {
                    form.Active_Flag__c = false;
                }
            }
        }

        // Deactivate other forms
        if (!formsToDeactivate.isEmpty()) {
            update formsToDeactivate;
        }
    }
    
    // After Insert Logic - Send email notifications
    if (Trigger.isAfter && Trigger.isInsert) {
        // Filter forms that have valid department information
        List<Feedback_Form__c> formsToNotify = new List<Feedback_Form__c>();
        
        for (Feedback_Form__c form : Trigger.new) {
            if (String.isNotBlank(form.department__c) && String.isNotBlank(form.Title__c)) {
                formsToNotify.add(form);
            }
        }
        
        // Send email notifications to department employees
        if (!formsToNotify.isEmpty()) {
            EmailController.sendFormCreationNotification(formsToNotify);
        }
    }
}