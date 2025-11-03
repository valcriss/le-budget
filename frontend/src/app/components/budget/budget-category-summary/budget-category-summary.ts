import { Component, Input } from '@angular/core';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';
import { Category } from '../../../core/categories/categories.models';
import { BudgetCategory } from '../../../core/budget/budget.models';

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
  @Input() budgetCategory: BudgetCategory | null | undefined = null

  formatCurrencyWithSign(value?: string | number) {
    return formatCurrencyWithSign(value, false);
  }

  getAvailableFromPreviousMonth() {
    return (this.budgetCategory?.available ?? 0) - (this.budgetCategory?.assigned ?? 0) - (this.budgetCategory?.activity ?? 0);
  }

  getAmountClass(value?: string | number) {
    return getAmountClass(value);
  }
}
