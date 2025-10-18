import { Component, Input } from '@angular/core';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-accounts-table',
  imports: [FontAwesomeModule],
  templateUrl: './accounts-table.html',
  styleUrl: './accounts-table.css'
})
export class AccountsTable {
  protected readonly icEditAccount = faPenToSquare;

  constructor(library: FaIconLibrary) {
    library.addIcons(faPenToSquare);
  }

}
