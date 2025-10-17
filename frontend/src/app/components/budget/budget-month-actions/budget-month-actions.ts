import { Component } from '@angular/core';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-budget-month-actions',
  imports: [FontAwesomeModule],
  templateUrl: './budget-month-actions.html',
  styleUrl: './budget-month-actions.css'
})
export class BudgetMonthActions {
protected readonly icAction = faWandMagicSparkles;

  constructor(library: FaIconLibrary) {
    library.addIcons(faWandMagicSparkles);
  }
}
