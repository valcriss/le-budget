import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap } from '@angular/router';
import { ReplaySubject } from 'rxjs';
import { TransactionsStore } from '../../../core/transactions/transactions.store';
import { AccountTable } from './account-table';
import { Transaction } from '../../../core/transactions/transactions.models';
import { SimpleChange } from '@angular/core';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

class TransactionsStoreStub {
  readonly transactions = signal<Transaction[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly load = jest.fn().mockName('load').mockResolvedValue(undefined);
  readonly update = jest.fn().mockName('update').mockResolvedValue(null);
  readonly create = jest.fn().mockName('create').mockResolvedValue(null);
  readonly reset = jest.fn().mockName('reset');
  readonly clearError = jest.fn().mockName('clearError');
}

describe('AccountTable', () => {
  let component: AccountTable;
  let fixture: ComponentFixture<AccountTable>;
  let transactionsStore: TransactionsStoreStub;
  let paramMap$: ReplaySubject<ParamMap>;
  const initialParamMap = convertToParamMap({ id: 'account-1' });

  beforeEach(async () => {
    paramMap$ = new ReplaySubject<ParamMap>(1);
    paramMap$.next(initialParamMap);

    await TestBed.configureTestingModule({
      imports: [AccountTable],
      providers: [
        { provide: TransactionsStore, useClass: TransactionsStoreStub },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$.asObservable(),
            snapshot: { paramMap: initialParamMap },
          },
        },
      ],
    }).compileComponents();

    transactionsStore = TestBed.inject(TransactionsStore) as unknown as TransactionsStoreStub;

    jest.useFakeTimers().setSystemTime(new Date('2024-03-01T00:00:00Z'));
    fixture = TestBed.createComponent(AccountTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
    jest.useRealTimers();
  });

  it('loads transactions for the current account id', () => {
    expect(transactionsStore.load).toHaveBeenCalledWith('account-1');
  });

  it('reloads when navigating to a different account', () => {
    paramMap$.next(convertToParamMap({ id: 'account-2' }));

    expect(transactionsStore.load).toHaveBeenCalledWith('account-2');
  });

  it('swallows load errors when navigating to a different account', async () => {
    transactionsStore.load.mockRejectedValueOnce(new Error('boom'));
    paramMap$.next(convertToParamMap({ id: 'account-3' }));
    await Promise.resolve();

    expect(transactionsStore.load).toHaveBeenCalledWith('account-3');
  });

  it('does not reload when account id stays the same', () => {
    transactionsStore.load.mockClear();

    paramMap$.next(convertToParamMap({ id: 'account-1' }));

    expect(transactionsStore.load).not.toHaveBeenCalled();
  });

  it('resets store when account id missing', () => {
    paramMap$.next(convertToParamMap({}));

    expect(transactionsStore.reset).toHaveBeenCalled();
  });

  it('lazily creates a draft transaction', () => {
    transactionsStore.transactions.set([
      {
        id: 'existing-1',
        accountId: 'account-1',
        date: '2024-03-01',
        label: 'Transaction existante',
        categoryId: null,
        categoryName: null,
        amount: 42,
        balance: 42,
        status: 'NONE',
        transactionType: 'NONE',
        linkedTransactionId: null,
        createdAt: '2024-03-01T00:00:00Z',
        updatedAt: '2024-03-01T00:00:00Z',
      },
    ]);

    component.startNewTransaction();
    const rows = component['rows']();
    expect(rows[0].id).toMatch(/^draft-/);
    expect(rows[0].accountId).toBe('account-1');
    expect(component['autoEditKeyFor'](rows[0])).not.toBeNull();

    // Calling again should be a no-op while draft exists
    component.startNewTransaction();
    expect(component['rows']().length).toBe(2);
  });

  it('ignores draft creation when no account id', () => {
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as Mutable<ActivatedRoute['snapshot']>).paramMap = convertToParamMap({});
    paramMap$.next(convertToParamMap({}));

    component.startNewTransaction();
    expect(component['rows']()).toEqual([]);
  });

  it('removes draft on cancel', () => {
    component.startNewTransaction();
    const draft = component['rows']()[0];

    component['handleCancel'](draft);
    expect(component['rows']()[0]?.id).not.toBe(draft.id);
  });

  it('keeps draft when cancelling a persisted transaction', () => {
    component.startNewTransaction();
    const draft = component['rows']()[0];

    component['handleCancel']({
      ...draft,
      id: 'server-id',
    } as Transaction);

    expect(component['rows']()[0]?.id).toBe(draft.id);
  });

  it('handles status changes by delegating to the store', async () => {
    await component['handleStatusChange']({ id: 'server-1', status: 'POINTED' });
    expect(transactionsStore.update).toHaveBeenCalledWith('account-1', 'server-1', {
      status: 'POINTED',
    });
  });

  it('skips status updates when account id missing', async () => {
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as Mutable<ActivatedRoute['snapshot']>).paramMap = convertToParamMap({});
    (component as unknown as { currentAccountId: string | null }).currentAccountId = null;
    transactionsStore.update.mockClear();

    await component['handleStatusChange']({ id: 'server-1', status: 'NONE' });
    expect(transactionsStore.update).not.toHaveBeenCalled();
  });

  it('creates transaction from draft and clears it afterwards', async () => {
    const created: Transaction = {
      id: 'server-1',
      accountId: 'account-1',
      date: '2024-03-01',
      label: 'Nouveau',
      categoryId: null,
      categoryName: null,
      amount: 25,
      balance: 67,
      status: 'NONE',
      transactionType: 'NONE',
      linkedTransactionId: null,
      createdAt: '2024-03-01T00:00:00Z',
      updatedAt: '2024-03-01T00:00:00Z',
    };
    transactionsStore.create.mockResolvedValueOnce(created);

    component.startNewTransaction();
    const draft = component['rows']()[0];

    await component['handleSave'](draft, {
      changes: {
        label: 'Nouveau',
        date: '2024-03-02',
        amount: 25,
        categoryId: null,
      },
    });

    expect(transactionsStore.create).toHaveBeenCalledWith('account-1', {
      date: '2024-03-02',
      label: 'Nouveau',
      amount: 25,
      categoryId: null,
      status: 'NONE',
      transactionType: 'NONE',
    });
    expect(component['rows']()[0]?.id).not.toBe(draft.id);
    expect(component['autoEditKeyFor'](draft)).toBeNull();
  });

  it('uses draft defaults when save changes omit fields', async () => {
    const created: Transaction = {
      id: 'server-2',
      accountId: 'account-1',
      date: '2024-03-01',
      label: 'Draft label',
      categoryId: 'cat-1',
      categoryName: 'Category',
      amount: 12,
      balance: 12,
      status: 'NONE',
      transactionType: 'NONE',
      linkedTransactionId: null,
      createdAt: '2024-03-01T00:00:00Z',
      updatedAt: '2024-03-01T00:00:00Z',
    };
    transactionsStore.create.mockResolvedValueOnce(created);

    component.startNewTransaction();
    const draft = component['rows']()[0];

    await component['handleSave'](draft, { changes: {} });

    expect(transactionsStore.create).toHaveBeenCalledWith('account-1', {
      date: draft.date,
      label: draft.label,
      amount: draft.amount,
      categoryId: null,
      status: 'NONE',
      transactionType: 'NONE',
    });
  });

  it('keeps draft open when creation fails and applies changes', async () => {
    transactionsStore.create.mockResolvedValueOnce(null);
    component.startNewTransaction();
    const draft = component['rows']()[0];

    const initialKey = component['autoEditKeyFor'](draft);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(999999);

    await component['handleSave'](draft, {
      changes: { label: 'Échec', date: '2024-03-03', amount: 50, categoryId: 'cat-1' },
    });

    const updatedDraft = component['rows']()[0];
    expect(updatedDraft.label).toBe('Échec');
    expect(component['autoEditKeyFor'](updatedDraft)).not.toBe(initialKey);
    nowSpy.mockRestore();
  });

  it('updates the stored draft when creation fails', async () => {
    transactionsStore.create.mockResolvedValueOnce(null);
    component.startNewTransaction();
    const draft = component['rows']()[0];

    await component['handleSave'](draft, {
      changes: { label: 'Retry label', date: '2024-03-10', amount: 12 },
    });

    expect((component as any).draftTransaction().label).toBe('Retry label');
  });

  it('updates existing draft data when creation fails with a live draft', async () => {
    transactionsStore.create.mockResolvedValueOnce(null);
    component.startNewTransaction();
    const draft = component['rows']()[0];
    (component as any).draftTransaction.set({ ...draft, label: 'Existing' });

    await component['handleSave'](draft, { changes: { label: 'Updated' } });

    expect(component['rows']()[0].label).toBe('Updated');
  });

  it('updates existing transactions via store', async () => {
    const transaction: Transaction = {
      id: 'persisted-1',
      accountId: 'account-1',
      date: '2024-03-01',
      label: 'Initiale',
      categoryId: null,
      categoryName: null,
      amount: 10,
      balance: 100,
      status: 'NONE',
      transactionType: 'NONE',
      linkedTransactionId: null,
      createdAt: '2024-03-01T00:00:00Z',
      updatedAt: '2024-03-01T00:00:00Z',
    };

    await component['handleSave'](transaction, { id: transaction.id, changes: { amount: 20 } });

    expect(transactionsStore.update).toHaveBeenCalledWith('account-1', 'persisted-1', {
      amount: 20,
    });
  });

  it('starts a draft when addTransactionTrigger changes', () => {
    expect(component['rows']()).toEqual([]);

    component.addTransactionTrigger = 1;
    component.ngOnChanges({ addTransactionTrigger: new SimpleChange(0, 1, false) });

    expect(component['rows']().length).toBe(1);
  });

  it('handles failed creation when draft already cleared', async () => {
    component.startNewTransaction();
    const draft = component['rows']()[0];
    (component as unknown as { draftTransaction: { set(value: Transaction | null): void } })
      .draftTransaction.set(null);
    transactionsStore.create.mockResolvedValueOnce(null);

    await component['handleSave'](draft, { changes: { label: 'Retry' } });

    expect(component['rows']()[0]?.id).not.toBe(draft.id);
  });

  it('returns id from trackBy helper', () => {
    const transaction: Transaction = {
      id: 'persisted-2',
      accountId: 'account-1',
      date: '2024-03-01',
      label: 'Sample',
      categoryId: null,
      categoryName: null,
      amount: 10,
      balance: 20,
      status: 'NONE',
      transactionType: 'NONE',
      linkedTransactionId: null,
      createdAt: '2024-03-01T00:00:00Z',
      updatedAt: '2024-03-01T00:00:00Z',
    };
    expect(component['trackByTransactionId'](0, transaction)).toBe('persisted-2');
  });

  it('skips save when no account id is available', async () => {
    const transaction: Transaction = {
      id: 'draft',
      accountId: 'account-unknown',
      date: '2024-03-01',
      label: '',
      categoryId: null,
      categoryName: null,
      amount: 0,
      balance: 0,
      status: 'NONE',
      transactionType: 'NONE',
      linkedTransactionId: null,
      createdAt: '2024-03-01T00:00:00Z',
      updatedAt: '2024-03-01T00:00:00Z',
    };

    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as Mutable<ActivatedRoute['snapshot']>).paramMap = convertToParamMap({});
    (component as unknown as { currentAccountId: string | null }).currentAccountId = null;
    transactionsStore.create.mockClear();
    transactionsStore.update.mockClear();

    await component['handleSave'](transaction, { id: transaction.id, changes: { amount: 10 } });

    expect(transactionsStore.create).not.toHaveBeenCalled();
    expect(transactionsStore.update).not.toHaveBeenCalled();
  });
});
