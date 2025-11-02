import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Header } from '../../components/ui/header/header';
import { BudgetHeader } from '../../components/budget/budget-header/budget-header';
import { UiCard } from '../../components/ui/ui-card/ui-card';
import { BudgetMenu } from '../../components/budget/budget-menu/budget-menu';
import { BudgetCategories } from '../../components/budget/budget-categories/budget-categories';
import { BudgetMonthSummary } from '../../components/budget/budget-month-summary/budget-month-summary';
import { BudgetMonthActions } from '../../components/budget/budget-month-actions/budget-month-actions';
import { BudgetCategorySummary } from '../../components/budget/budget-category-summary/budget-category-summary';
import { BudgetCategoryActions } from '../../components/budget/budget-category-actions/budget-category-actions';
import { BudgetStore } from '../../core/budget/budget.store';
import {
  formatMonthLabel,
  getCurrentMonthKey,
  normalizeMonthKey,
  shiftMonthKey,
} from '../../core/budget/budget.utils';

@Component({
  selector: 'app-budget-page',
  imports: [CommonModule, Header, BudgetHeader, UiCard, BudgetMenu, BudgetCategories, BudgetMonthSummary, BudgetMonthActions, BudgetCategorySummary, BudgetCategoryActions],
  templateUrl: './budget-page.html',
  styleUrl: './budget-page.css',
})
export class BudgetPage {
  private readonly budgetStore = inject(BudgetStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly month = this.budgetStore.month;
  readonly groups = this.budgetStore.groups;
  readonly loading = this.budgetStore.loading;
  readonly error = this.budgetStore.error;

  readonly monthLabel = computed(() => {
    const monthData = this.month();
    const monthKey = monthData?.month ?? this.budgetStore.monthKey() ?? getCurrentMonthKey();
    return formatMonthLabel(monthKey);
  });

  readonly monthKey = computed(
    () => this.month()?.month ?? this.budgetStore.monthKey() ?? getCurrentMonthKey(),
  );

  readonly monthSummary = computed(() => {
    const monthData = this.month();
    const carryover = monthData?.availableCarryover ?? 0;
    const income = monthData?.income ?? 0;
    const assigned =
      monthData?.assigned !== undefined && monthData?.assigned !== null
        ? monthData.assigned
        : monthData?.totalAssigned ?? 0;
    const activity =
      monthData?.activity !== undefined && monthData?.activity !== null
        ? monthData.activity
        : monthData?.totalActivity ?? 0;
    const available =
      monthData?.available !== undefined && monthData?.available !== null
        ? monthData.available
        : monthData?.totalAvailable ?? 0;
    return {
      availableCarryover: carryover,
      income,
      assigned,
      activity,
      available,
      resourcesTotal: carryover + income,
      totalCharges: assigned + activity,
      totalAssigned: assigned,
      totalActivity: activity,
      totalAvailable: available,
    };
  });

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const monthParam = params.get('month');
        const monthKey = monthParam ? normalizeMonthKey(monthParam) : getCurrentMonthKey();
        const shouldUpdateUrl = !monthParam;
        if (shouldUpdateUrl) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { month: monthKey },
            replaceUrl: true,
          });
        }
        const alreadyLoaded = this.budgetStore.hasData();
        void this.budgetStore.loadMonth(monthKey, alreadyLoaded).catch(() => undefined);
      });
  }

  onPreviousMonth(): void {
    this.navigateToOffset(-1);
  }

  onNextMonth(): void {
    this.navigateToOffset(1);
  }

  private navigateToOffset(offset: number): void {
    const currentKey = this.monthKey();
    const targetKey = shiftMonthKey(currentKey, offset);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { month: targetKey },
      replaceUrl: true,
      queryParamsHandling: 'merge',
    });
  }
}
