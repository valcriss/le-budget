import { Component } from '@angular/core';
import { Header } from '../../components/ui/header/header';
import { BudgetHeader } from '../../components/budget/budget-header/budget-header';
import { UiCard } from '../../components/ui/ui-card/ui-card';
import { BudgetMenu } from '../../components/budget/budget-menu/budget-menu';
import { BudgetCategories } from '../../components/budget/budget-categories/budget-categories';
import { BudgetMonthSummary } from '../../components/budget/budget-month-summary/budget-month-summary';
import { BudgetMonthActions } from '../../components/budget/budget-month-actions/budget-month-actions';
import { BudgetCategorySummary } from '../../components/budget/budget-category-summary/budget-category-summary';
import { BudgetCategoryActions } from '../../components/budget/budget-category-actions/budget-category-actions';

@Component({
  selector: 'app-budget-page',
  imports: [Header, BudgetHeader, UiCard, BudgetMenu, BudgetCategories, BudgetMonthSummary, BudgetMonthActions, BudgetCategorySummary, BudgetCategoryActions],
  templateUrl: './budget-page.html',
  styleUrl: './budget-page.css',
})
export class BudgetPage {}
