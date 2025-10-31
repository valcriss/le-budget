import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faPlusSquare } from '@fortawesome/free-solid-svg-icons';
import { AccountDialog } from '../account-dialog/account-dialog';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { CreateAccountInput } from '../../../core/accounts/accounts.models';

@Component({
  selector: 'app-accounts-menu',
  imports: [ CommonModule, FontAwesomeModule, AccountDialog ],
  templateUrl: './accounts-menu.html',
  styleUrl: './accounts-menu.css'
})
export class AccountsMenu {
  private readonly accountsStore = inject(AccountsStore);
  protected readonly icAddAccount = faPlusSquare;
  protected readonly dialogOpen = signal(false);
  protected readonly submitting = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly defaultCurrency = this.accountsStore.defaultCurrency;

  constructor(library: FaIconLibrary) {
    library.addIcons(faPlusSquare);
  }

  protected openDialog(): void {
    this.accountsStore.clearSaveError();
    this.dialogError.set(null);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    if (this.submitting()) {
      return;
    }
    this.dialogOpen.set(false);
  }

  protected async handleCreateAccount(
    payload: Omit<CreateAccountInput, 'currency' | 'reconciledBalance' | 'archived'>,
  ): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.dialogError.set(null);
    try {
      const initialBalance = payload.initialBalance ?? 0;
      const currency = this.accountsStore.defaultCurrency();
      const next: CreateAccountInput = {
        name: payload.name,
        type: payload.type,
        initialBalance,
        reconciledBalance: initialBalance,
        currency,
      };
      await this.accountsStore.createAccount(next);
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
      this.submitting.set(false);
    }
  }
}
