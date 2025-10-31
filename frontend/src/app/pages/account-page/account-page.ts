import { Component } from '@angular/core';
import { Header } from '../../components/ui/header/header';
import { UiCard } from '../../components/ui/ui-card/ui-card';
import { AccountsList } from '../../components/accounts/accounts-list/accounts-list';
import { AccountTable } from '../../components/account/account-table/account-table';
import { AccountMenu } from '../../components/account/account-menu/account-menu';

@Component({
  selector: 'app-account-page',
  imports: [Header, UiCard, AccountsList, AccountTable, AccountMenu],
  templateUrl: './account-page.html',
  styleUrl: './account-page.css',
})
export class AccountPage {
  protected addTransactionTrigger = 0;

  protected handleAddTransaction(): void {
    this.addTransactionTrigger++;
  }
}
