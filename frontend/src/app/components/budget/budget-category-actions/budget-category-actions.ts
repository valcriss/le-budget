import { Component } from '@angular/core';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-budget-category-actions',
  imports: [FontAwesomeModule],
  templateUrl: './budget-category-actions.html',
  styleUrl: './budget-category-actions.css'
})
export class BudgetCategoryActions {
  icAction = faWandMagicSparkles;
  constructor(library: FaIconLibrary) {
    library.addIcons(faWandMagicSparkles);
  }
}
