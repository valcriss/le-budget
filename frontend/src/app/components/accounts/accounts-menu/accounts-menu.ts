import { Component } from '@angular/core';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faPlusSquare } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-accounts-menu',
  imports: [ FontAwesomeModule ],
  templateUrl: './accounts-menu.html',
  styleUrl: './accounts-menu.css'
})
export class AccountsMenu {
  protected readonly icAddAccount = faPlusSquare;

  constructor(library: FaIconLibrary) {
    library.addIcons(faPlusSquare);
  }
}
