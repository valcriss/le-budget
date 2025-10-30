import { Component, inject } from '@angular/core';
import { Header } from '../../components/ui/header/header';
import { UiCard } from '../../components/ui/ui-card/ui-card';
import { AccountsMenu } from '../../components/accounts/accounts-menu/accounts-menu';
import { AccountsTable } from '../../components/accounts/accounts-table/accounts-table';
import { AccountsStore } from '../../core/accounts/accounts.store';

@Component({
  selector: 'app-accounts-page',
  imports: [Header, UiCard, AccountsMenu, AccountsTable],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.css'
})
export class AccountsPage {
  private readonly accountsStore = inject(AccountsStore);

  constructor() {
    void this.accountsStore.loadAccounts().catch(() => undefined);
  }
}
