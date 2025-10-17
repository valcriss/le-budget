import { Component, Input } from '@angular/core';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';

@Component({
  selector: 'app-budget-month-summary',
  imports: [],
  templateUrl: './budget-month-summary.html',
  styleUrl: './budget-month-summary.css'
})
export class BudgetMonthSummary {

  @Input() availableFromPreviousMonth: number = 0
  @Input() incomesOfTheCurrentMonth: number = 0
  @Input() totalAssigned: number = 0
  @Input() totalPaid: number = 0
  @Input() totalAvailable: number = 0

  formatCurrencyWithSign(value?: string | number) {
    return formatCurrencyWithSign(value, false);
  }

  getAmountClass(value?: string | number) {
    return getAmountClass(value);
  }
}
