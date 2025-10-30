import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { Account } from '../../../core/accounts/accounts.models';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';

@Component({
  selector: 'app-accounts-list',
  imports: [CommonModule, RouterLink],
  templateUrl: './accounts-list.html',
  styleUrl: './accounts-list.css'
})
export class AccountsList {

  private readonly accountsStore = inject(AccountsStore);

  protected readonly accounts = this.accountsStore.accounts;
  protected readonly loading = this.accountsStore.loading;
  protected readonly error = this.accountsStore.error;
  protected readonly amountClass = getAmountClass;
  protected readonly trackByAccountId = (_: number, account: Account) => account.id;

  constructor() {
    void this.accountsStore.loadAccounts().catch(() => undefined);
  }

  // Expose the formatter functions to the template
  protected formatAmount(value?: string | number) {
    return formatCurrencyWithSign(value, false);
  }

}
