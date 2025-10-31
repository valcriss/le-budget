import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { Account } from '../../../core/accounts/accounts.models';
import { formatCurrency, getAmountClass } from '../../../shared/formatters';
import { AccountDialog } from '../account-dialog/account-dialog';

@Component({
  selector: 'app-accounts-table',
  imports: [CommonModule, FontAwesomeModule, RouterLink, AccountDialog],
  templateUrl: './accounts-table.html',
  styleUrl: './accounts-table.css'
})
export class AccountsTable {
  protected readonly icEditAccount = faPenToSquare;
  protected readonly formatCurrency = formatCurrency;
  protected readonly amountClass = getAmountClass;
  protected readonly dialogOpen = signal(false);
  protected readonly dialogSubmitting = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly dialogInitialValue = signal<{ id: string; name: string; type: Account['type'] } | null>(null);

  private readonly accountsStore = inject(AccountsStore);

  protected readonly accounts = this.accountsStore.accounts;
  protected readonly loading = this.accountsStore.loading;
  protected readonly error = this.accountsStore.error;
  protected readonly totals = this.accountsStore.totals;
  protected readonly defaultCurrency = this.accountsStore.defaultCurrency;

  protected readonly trackByAccountId = (_: number, account: Account) => account.id;

  constructor(library: FaIconLibrary) {
    library.addIcons(faPenToSquare);
  }

  protected openEditDialog(account: Account): void {
    this.dialogError.set(null);
    this.dialogSubmitting.set(false);
    this.dialogInitialValue.set({ id: account.id, name: account.name, type: account.type });
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    if (this.dialogSubmitting()) {
      return;
    }
    this.dialogOpen.set(false);
  }

  protected async handleUpdate(payload: { name: string; type: Account['type']; initialBalance?: number }): Promise<void> {
    const current = this.dialogInitialValue();
    if (!current) {
      return;
    }
    this.dialogSubmitting.set(true);
    this.dialogError.set(null);
    try {
      await this.accountsStore.updateAccount(current.id, {
        name: payload.name,
        type: payload.type,
      });
      this.dialogOpen.set(false);
    } catch (error) {
      const message = this.accountsStore.saveError();
      if (message) {
        this.dialogError.set(message);
      } else if (error instanceof Error && error.message) {
        this.dialogError.set(error.message);
      } else {
        this.dialogError.set('Impossible de mettre à jour le compte.');
      }
    } finally {
      this.dialogSubmitting.set(false);
    }
  }

}
