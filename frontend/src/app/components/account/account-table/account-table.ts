import { Component } from '@angular/core';
import { Checkbox } from "../../ui/checkbox/checkbox";
import { AccountTransaction } from "../account-transaction/account-transaction";
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faCircle} from '@fortawesome/free-solid-svg-icons';
@Component({
  selector: 'app-account-table',
  imports: [Checkbox, AccountTransaction, FontAwesomeModule],
  templateUrl: './account-table.html',
  styleUrl: './account-table.css'
})
export class AccountTable {
  constructor(library: FaIconLibrary) {
    library.addIcons(faCircle);
  }
   protected icCircle = faCircle;
}
