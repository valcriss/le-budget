import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnChanges, SimpleChanges, computed, inject, signal } from '@angular/core';
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
import { Transaction, CreateTransactionPayload } from '../../../core/transactions/transactions.models';
import { AccountTransactionStatusEvent } from '../account-transaction/account-transaction';

@Component({
  selector: 'app-account-table',
  imports: [CommonModule, Checkbox, AccountTransaction, FontAwesomeModule],
  templateUrl: './account-table.html',
  styleUrl: './account-table.css',
})
export class AccountTable implements OnChanges {
  protected readonly icCircle = faCircle;

  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transactionsStore = inject(TransactionsStore);

  protected readonly transactions = this.transactionsStore.transactions;
  protected readonly loading = this.transactionsStore.loading;
  protected readonly error = this.transactionsStore.error;

  private readonly draftTransaction = signal<Transaction | null>(null);
  private readonly draftAutoEditKey = signal<number | null>(null);

  @Input() addTransactionTrigger = 0;

  protected readonly rows = computed(() => {
    const draft = this.draftTransaction();
    const items = this.transactions();
    if (!draft) {
      return items;
    }
    return [draft, ...items];
  });

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['addTransactionTrigger'] && !changes['addTransactionTrigger'].firstChange) {
      this.startNewTransaction();
    }
  }

  startNewTransaction(): void {
    if (this.draftTransaction()) {
      return;
    }
    const accountId = this.currentAccountId ?? this.route.snapshot.paramMap.get('id');
    if (!accountId) {
      return;
    }
    const now = new Date();
    const draft: Transaction = {
      id: `draft-${now.getTime()}`,
      accountId,
      date: now.toISOString().slice(0, 10),
      label: '',
      categoryId: null,
      categoryName: null,
      amount: 0,
      balance: this.transactions()[0]?.balance ?? 0,
      status: 'NONE',
      transactionType: 'NONE',
      linkedTransactionId: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.draftTransaction.set(draft);
    this.draftAutoEditKey.set(now.getTime());
  }

  protected trackByTransactionId(_: number, transaction: Transaction): string {
    return transaction.id;
  }

  protected autoEditKeyFor(transaction: Transaction): number | null {
    return this.isDraft(transaction) ? this.draftAutoEditKey() : null;
  }

  protected isDraft(transaction: Transaction): boolean {
    return this.draftTransaction()?.id === transaction.id;
  }

  protected handleCancel(transaction: Transaction): void {
    if (this.isDraft(transaction)) {
      this.draftTransaction.set(null);
      this.draftAutoEditKey.set(null);
    }
  }

  protected async handleStatusChange(event: AccountTransactionStatusEvent): Promise<void> {
    const accountId = this.currentAccountId ?? this.route.snapshot.paramMap.get('id');
    if (!accountId) {
      return;
    }
    await this.transactionsStore.update(accountId, event.id, { status: event.status });
  }

  protected async handleSave(
    transaction: Transaction,
    event: AccountTransactionUpdateEvent,
  ): Promise<void> {
    const accountId = this.currentAccountId ?? this.route.snapshot.paramMap.get('id');
    if (!accountId) {
      return;
    }
    if (this.isDraft(transaction)) {
      const payload: CreateTransactionPayload = {
        date: event.changes.date ?? transaction.date,
        label: event.changes.label ?? transaction.label,
        amount: event.changes.amount ?? transaction.amount,
        categoryId: event.changes.categoryId ?? null,
        status: 'NONE',
        transactionType: 'NONE',
      };

      const created = await this.transactionsStore.create(accountId, payload);
      if (created) {
        this.draftTransaction.set(null);
        this.draftAutoEditKey.set(null);
      } else {
        const existingDraft = this.draftTransaction();
        if (existingDraft) {
          this.draftTransaction.set({
            ...existingDraft,
            date: payload.date,
            label: payload.label,
            categoryId: payload.categoryId ?? null,
            amount: payload.amount,
          });
          this.draftAutoEditKey.set(Date.now());
        }
      }
      return;
    }

    await this.transactionsStore.update(accountId, event.id, event.changes);
  }
}
