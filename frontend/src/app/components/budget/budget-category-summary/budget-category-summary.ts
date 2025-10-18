import { Component, Input } from '@angular/core';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';

@Component({
  selector: 'app-budget-category-summary',
  imports: [],
  templateUrl: './budget-category-summary.html',
  styleUrl: './budget-category-summary.css'
})
export class BudgetCategorySummary {
  @Input() availableFromPreviousMonth: number = 0
  @Input() assignedThisMonth: number = 0
  @Input() totalAssigned: number = 0
  @Input() totalPaid: number = 0
  @Input() totalAvailable: number = 0

  @Input() neededThisMonth: number = 0
  @Input() neededForNextMonths: number = 0

  formatCurrencyWithSign(value?: string | number) {
    return formatCurrencyWithSign(value, false);
  }

  getAmountClass(value?: string | number) {
    return getAmountClass(value);
  }
}
