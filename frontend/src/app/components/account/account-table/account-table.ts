import { Component } from '@angular/core';
import { Checkbox } from "../../ui/checkbox/checkbox";
import { AccountTransaction } from "../account-transaction/account-transaction";

@Component({
  selector: 'app-account-table',
  imports: [Checkbox, AccountTransaction],
  templateUrl: './account-table.html',
  styleUrl: './account-table.css'
})
export class AccountTable {

}
