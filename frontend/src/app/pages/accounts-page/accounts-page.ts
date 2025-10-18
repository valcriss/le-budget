import { Component } from '@angular/core';
import { Header } from '../../components/ui/header/header';
import { UiCard } from '../../components/ui/ui-card/ui-card';
import { AccountsMenu } from '../../components/accounts/accounts-menu/accounts-menu';
import { AccountsTable } from '../../components/accounts/accounts-table/accounts-table';

@Component({
  selector: 'app-accounts-page',
  imports: [Header, UiCard, AccountsMenu, AccountsTable],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.css'
})
export class AccountsPage {

}
