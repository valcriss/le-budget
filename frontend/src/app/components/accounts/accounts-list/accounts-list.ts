import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { Account } from '../../../core/accounts/accounts.models';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';
import { AccountDialog } from '../account-dialog/account-dialog';

@Component({
  selector: 'app-accounts-list',
  imports: [CommonModule, RouterLink, AccountDialog],
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
  protected readonly dialogOpen = signal(false);
  protected readonly dialogSubmitting = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly defaultCurrency = this.accountsStore.defaultCurrency;
  private readonly route = inject(ActivatedRoute);
  protected readonly highlightedAccountId = computed(() => this.route.snapshot.paramMap.get('id'));

  constructor() {
    void this.accountsStore.loadAccounts().catch(() => undefined);
  }

  // Expose the formatter functions to the template
  protected formatAmount(value?: string | number) {
    return formatCurrencyWithSign(value, false);
  }

  protected openDialog(): void {
    this.accountsStore.clearSaveError();
    this.dialogError.set(null);
    this.dialogSubmitting.set(false);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    if (this.dialogSubmitting()) {
      return;
    }
    this.dialogOpen.set(false);
  }

  protected async handleCreate(payload: { name: string; type: Account['type']; initialBalance?: number }): Promise<void> {
    if (this.dialogSubmitting()) {
      return;
    }
    this.dialogSubmitting.set(true);
    this.dialogError.set(null);
    try {
      const initialBalance = payload.initialBalance ?? 0;
      await this.accountsStore.createAccount({
        name: payload.name,
        type: payload.type,
        initialBalance,
        reconciledBalance: initialBalance,
        currency: this.accountsStore.getDefaultCurrency(),
      });
      this.accountsStore.clearSaveError();
      this.dialogOpen.set(false);
    } catch (error) {
      const message = this.accountsStore.saveError();
      if (message) {
        this.dialogError.set(message);
      } else if (error instanceof Error && error.message) {
        this.dialogError.set(error.message);
      } else {
        this.dialogError.set('Impossible de créer le compte.');
      }
    } finally {
      this.dialogSubmitting.set(false);
    }
  }
}
