import { Component } from '@angular/core';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare,faPlusSquare } from '@fortawesome/free-solid-svg-icons';
@Component({
  selector: 'app-account-menu',
  imports: [FontAwesomeModule],
  templateUrl: './account-menu.html',
  styleUrl: './account-menu.css'
})
export class AccountMenu {

  protected readonly icEditAccount = faPenToSquare;
  protected readonly icTransactionAdd = faPlusSquare;

  constructor(library: FaIconLibrary) {
    library.addIcons(faPenToSquare, faPlusSquare);
  }

}
