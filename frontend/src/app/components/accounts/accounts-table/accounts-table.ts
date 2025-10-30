import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { Account } from '../../../core/accounts/accounts.models';
import { formatCurrency, getAmountClass } from '../../../shared/formatters';

@Component({
  selector: 'app-accounts-table',
  imports: [CommonModule, FontAwesomeModule, RouterLink],
  templateUrl: './accounts-table.html',
  styleUrl: './accounts-table.css'
})
export class AccountsTable {
  protected readonly icEditAccount = faPenToSquare;
  protected readonly formatCurrency = formatCurrency;
  protected readonly amountClass = getAmountClass;

  private readonly accountsStore = inject(AccountsStore);

  protected readonly accounts = this.accountsStore.accounts;
  protected readonly loading = this.accountsStore.loading;
  protected readonly error = this.accountsStore.error;
  protected readonly totals = this.accountsStore.totals;

  protected readonly trackByAccountId = (_: number, account: Account) => account.id;

  constructor(library: FaIconLibrary) {
    library.addIcons(faPenToSquare);
  }

}
