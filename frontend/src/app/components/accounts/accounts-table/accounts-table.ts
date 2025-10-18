import { Component } from '@angular/core';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-accounts-table',
  imports: [FontAwesomeModule],
  templateUrl: './accounts-table.html',
  styleUrl: './accounts-table.css'
})
export class AccountsTable {
  protected readonly icChevronRight = faChevronRight;

  constructor(library: FaIconLibrary) {
    library.addIcons(faChevronRight);
  }

}
