import { Component } from '@angular/core';
import { Header } from '../../components/ui/header/header';
import { UiCard } from '../../components/ui/ui-card/ui-card';
import { AccountsList } from '../../components/accounts/accounts-list/accounts-list';
import { AccountTable } from '../../components/account/account-table/account-table';
@Component({
  selector: 'app-account-page',
  imports: [Header, UiCard, AccountsList, AccountTable],
  templateUrl: './account-page.html',
  styleUrl: './account-page.css'
})
export class AccountPage {

}
