import { Component } from '@angular/core';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faPlusSquare } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-budget-menu',
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './budget-menu.html',
  styleUrls: ['./budget-menu.css'],
})
export class BudgetMenu {
  protected readonly icCategoryGroup = faPlusSquare;

  constructor(library: FaIconLibrary) {
    library.addIcons(faPlusSquare);
  }
}
