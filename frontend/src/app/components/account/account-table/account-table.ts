import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faCircle } from '@fortawesome/free-solid-svg-icons';
import { Checkbox } from '../../ui/checkbox/checkbox';
import {
  AccountTransaction,
  AccountTransactionUpdateEvent,
} from '../account-transaction/account-transaction';
import { TransactionsStore } from '../../../core/transactions/transactions.store';
import { Transaction } from '../../../core/transactions/transactions.models';

@Component({
  selector: 'app-account-table',
  imports: [CommonModule, Checkbox, AccountTransaction, FontAwesomeModule],
  templateUrl: './account-table.html',
  styleUrl: './account-table.css',
})
export class AccountTable {
  protected readonly icCircle = faCircle;

  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transactionsStore = inject(TransactionsStore);

  protected readonly transactions = this.transactionsStore.transactions;
  protected readonly loading = this.transactionsStore.loading;
  protected readonly error = this.transactionsStore.error;

  private currentAccountId: string | null = null;

  constructor(library: FaIconLibrary) {
    library.addIcons(faCircle);

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const accountId = params.get('id');
      if (!accountId) {
        this.currentAccountId = null;
        this.transactionsStore.reset();
        return;
      }
      if (accountId === this.currentAccountId) {
        return;
      }
      this.currentAccountId = accountId;
      void this.transactionsStore.load(accountId).catch(() => undefined);
    });
  }

  protected trackByTransactionId(_: number, transaction: Transaction): string {
    return transaction.id;
  }

  protected async handleSave(event: AccountTransactionUpdateEvent): Promise<void> {
    const accountId = this.currentAccountId ?? this.route.snapshot.paramMap.get('id');
    if (!accountId) {
      return;
    }
    await this.transactionsStore.update(accountId, event.id, event.changes);
  }
}
