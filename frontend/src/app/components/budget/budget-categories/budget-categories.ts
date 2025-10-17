import { Component } from '@angular/core';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { BudgetCategoryGroup } from '../budget-category-group/budget-category-group';

@Component({
  selector: 'app-budget-categories',
  imports: [FontAwesomeModule, BudgetCategoryGroup],
  templateUrl: './budget-categories.html',
  styleUrl: './budget-categories.css',
})
export class BudgetCategories {
  protected readonly icChevronRight = faChevronRight;

  constructor(library: FaIconLibrary) {
    library.addIcons(faChevronRight);
  }
}
