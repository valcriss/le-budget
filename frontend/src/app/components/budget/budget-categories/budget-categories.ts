import { Component } from '@angular/core';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CommonModule } from '@angular/common';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { BudgetCategoryGroup } from '../budget-category-group/budget-category-group';
import { BUDGET_TEST_DATA } from '../test-data/budget-test-data';

@Component({
  selector: 'app-budget-categories',
  imports: [CommonModule, FontAwesomeModule, BudgetCategoryGroup],
  templateUrl: './budget-categories.html',
  styleUrl: './budget-categories.css',
})
export class BudgetCategories {
  protected readonly icChevronRight = faChevronRight;

  constructor(library: FaIconLibrary) {
    library.addIcons(faChevronRight);
  }

  // expose test groups for template rendering
  groups = BUDGET_TEST_DATA;
}
