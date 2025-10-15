import { Component, Input } from '@angular/core';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faPlusCircle, faMinusCircle } from '@fortawesome/free-solid-svg-icons';

@Component({
    selector: 'app-budget-status',
    standalone: true,
    imports: [FontAwesomeModule],
    templateUrl: './budget-status.html',
    styleUrls: ['./budget-status.css']
})
export class BudgetStatus {
    protected readonly icIncomes = faPlusCircle;
    protected readonly icExpenses = faMinusCircle;

    @Input() available?: string | number;
}
