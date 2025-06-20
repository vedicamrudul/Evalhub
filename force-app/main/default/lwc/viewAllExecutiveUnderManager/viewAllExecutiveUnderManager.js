import { LightningElement, wire } from 'lwc';
import getUsersUnderCurrentUser from '@salesforce/apex/UserController.getUsersUnderCurrentUser';

export default class ViewAllExecutiveUnderManager extends LightningElement {
    users = [];
    error;
    isLoading = true;
    
    columns = [
        { label: 'Name', fieldName: 'Name', type: 'text' },
        { label: 'Email', fieldName: 'Email', type: 'email' },
        { label: 'Department', fieldName: 'department__c', type: 'text' },
        { label: 'Role', fieldName: 'RoleName', type: 'text' },
    ];

    @wire(getUsersUnderCurrentUser)
    wiredUsersUnderCurrentUser({ error, data }) {
        this.isLoading = false;
        if (data) {
            // Transform data to include role name in a flat structure
            this.users = data.map(user => ({
                ...user,
                RoleName: user.UserRole ? user.UserRole.Name : ''
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error.body ? error.body.message : 'Unknown error';
            this.users = [];
        }
    }

    get hasUsers() {
        return this.users && this.users.length > 0;
    }

    handleClick() {
        console.log('Users under current manager:', this.users);
    }
}