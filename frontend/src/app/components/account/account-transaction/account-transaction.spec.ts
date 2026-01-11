import { Injectable, SimpleChange, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoriesStore } from '../../../core/categories/categories.store';
import { AccountTransaction, AccountTransactionUpdateEvent } from './account-transaction';
import { Category } from '../../../core/categories/categories.models';
import { Transaction } from '../../../core/transactions/transactions.models';

@Injectable()
class CategoriesStoreStub {
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly ensureLoaded = jest.fn().mockName('ensureLoaded').mockResolvedValue(undefined);
}

describe('AccountTransaction', () => {
  let component: AccountTransaction;
  let fixture: ComponentFixture<AccountTransaction>;
  let categoriesStore: CategoriesStoreStub;

  const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 'tx-1',
    accountId: 'acc-1',
    date: '2024-01-31',
    label: 'Salaire',
    categoryId: 'cat-1',
    categoryName: 'Revenus',
    amount: 100,
    balance: 1000,
    status: 'NONE',
    transactionType: 'NONE',
    linkedTransactionId: null,
    createdAt: '2024-01-31T00:00:00.000Z',
    updatedAt: '2024-01-31T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountTransaction],
      providers: [{ provide: CategoriesStore, useClass: CategoriesStoreStub }],
    }).compileComponents();

    categoriesStore = TestBed.inject(CategoriesStore) as unknown as CategoriesStoreStub;
    fixture = TestBed.createComponent(AccountTransaction);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load categories', () => {
    expect(component).toBeTruthy();
    expect(categoriesStore.ensureLoaded).toHaveBeenCalled();
  });

  it('filters and sorts categories', () => {
    categoriesStore.categories.set([
      { id: '1', name: 'B-Item', kind: 'EXPENSE', parentCategoryId: 'root', color: '#fff' },
      { id: '2', name: 'A-Item', kind: 'INCOME', parentCategoryId: null, color: '#fff' },
      { id: '3', name: 'C-Item', kind: 'TRANSFER', parentCategoryId: null, color: '#fff' },
      { id: '4', name: 'D-Item', kind: 'EXPENSE', parentCategoryId: null, color: '#fff' },
    ]);

    const options = component['categoryOptions']();
    expect(options.map((c) => c.id)).toEqual(['2', '1', '3']);
    expect(component['categoryGroupLabel']({ name: 'INCOME' })).toBe('Revenus');
    expect(component['categoryGroupBy'](options[0]!)).toBe('INCOME');
    expect(component['categoryGroupBy']({ ...options[1]!, kind: 'TRANSFER' })).toBe('TRANSFER');
    expect(component['categoryGroupLabel']({ name: 'TRANSFER' })).toBe('Virements');
    expect(component['categoryGroupLabel']({ name: 'INITIAL' })).toBe('Initial');
    expect(component['categoryGroupLabel']({ name: 'EXPENSE' })).toBe('Dépenses');
    expect(component['categoryGroupLabel']({ name: 'UNKNOWN' })).toBe('UNKNOWN');
    expect(component['categoryGroupLabel']({ name: 'INCOME_PLUS_ONE' })).toBe('Revenus');
  });

  it('computes debit and credit helpers', () => {
    expect(component['debitAmount'](createTransaction({ amount: -50 }))).toBe(-50);
    expect(component['debitAmount'](createTransaction({ amount: 50 }))).toBe(0);
    expect(component['creditAmount'](createTransaction({ amount: 50 }))).toBe(50);
    expect(component['creditAmount'](createTransaction({ amount: -50 }))).toBe(0);
  });

  it('derives status icon metadata', () => {
    component.transaction = createTransaction({ status: 'NONE' });
    expect(component['statusIconClass']()).toBe('text-gray-300');
    expect(component['statusIconTitle']()).toContain('pointer');

    component.transaction = createTransaction({ status: 'POINTED' });
    expect(component['statusIconClass']()).toBe('text-emerald-500');
    expect(component['statusIconTitle']()).toContain('dépointer');

    component.transaction = createTransaction({ status: 'RECONCILED' });
    expect(component['statusIconClass']()).toBe('text-sky-600');
    expect(component['statusIconTitle']()).toBe('Transaction rapprochée');
  });

  it('formats dates for display', () => {
    expect(component['formatDisplayDate']('2024-03-05')).toBe('05/03/2024');
    expect(component['formatDisplayDate']('')).toBe('');
    expect(component['formatDisplayDate']('invalid')).toBe('invalid');
    const now = new Date('2024-03-01T00:00:00Z').toISOString();
    expect(component['formatDisplayDate'](now)).toContain('2024');
    expect(component['formatDisplayDate']('March 05 2024')).toBe('05/03/2024');
  });

  it('toggles status only when allowed', () => {
    const spy = jest.spyOn(component.changeStatus, 'emit');
    component.transaction = createTransaction({ status: 'NONE' });

    component['onStatusToggle']();
    expect(spy).toHaveBeenCalledWith({ id: 'tx-1', status: 'POINTED' });

    component.transaction = createTransaction({ status: 'RECONCILED' });
    component['onStatusToggle']();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('toggles from pointed back to none', () => {
    const spy = jest.spyOn(component.changeStatus, 'emit');
    component.transaction = createTransaction({ status: 'POINTED' });

    component['onStatusToggle']();

    expect(spy).toHaveBeenCalledWith({ id: 'tx-1', status: 'NONE' });
  });

  it('enters edit mode when requested', () => {
    expect(component['editing']).toBe(false);
    component['onDoubleClick']();
    expect(component['editing']).toBe(true);
    expect(component['editModel']).not.toBeNull();
  });

  it('does nothing when saving without an edit model', () => {
    const spy = jest.spyOn(component.save, 'emit');
    component['editModel'] = null;

    component['onSave']();

    expect(spy).not.toHaveBeenCalled();
  });

  it('starts editing on input changes with autoEditKey', () => {
    component.transaction = createTransaction({ amount: -10 });
    component.autoEditKey = 1;

    component.ngOnChanges({ autoEditKey: new SimpleChange(null, 1, false) });
    expect(component['editing']).toBe(true);
    expect(component['editModel']).toMatchObject({ debit: 10, credit: null });
  });

  it('starts editing when transaction changes and autoEditKey set', () => {
    component.transaction = createTransaction({ amount: 20 });
    component.autoEditKey = 1;

    component.ngOnChanges({ transaction: new SimpleChange(null, component.transaction, false) });

    expect(component['editing']).toBe(true);
    expect(component['editModel']).not.toBeNull();
  });

  it('does not start editing when autoEditKey is null', () => {
    component.transaction = createTransaction({ amount: 5 });
    component.autoEditKey = null;

    component.ngOnChanges({ autoEditKey: new SimpleChange(1, null, false) });

    expect(component['editing']).toBe(false);
    expect(component['editModel']).toBeNull();
  });

  it('cancels editing and emits cancel', () => {
    const cancelSpy = jest.spyOn(component.cancel, 'emit');
    component['onDoubleClick']();

    component['onCancel']();
    expect(component['editing']).toBe(false);
    expect(component['editModel']).toBeNull();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it.each`
    debit     | credit    | expected
    ${50}     | ${0}      | ${-50}
    ${0}      | ${80}     | ${80}
    ${20}     | ${30}     | ${10}
    ${null}   | ${null}   | ${0}
    ${'abc'}  | ${'xyz'}  | ${0}
  `('computes amount from debit/credit ($debit, $credit)', ({ debit, credit, expected }) => {
    const transaction = createTransaction({ amount: 10 });
    component.transaction = transaction;
    component['editModel'] = {
      date: '2024-02-01',
      label: '  Nouveau libellé ',
      categoryId: 'cat-2',
      debit,
      credit,
    };
    component['editing'] = true;
    const saveSpy = jest.spyOn(component.save, 'emit');

    component['onSave']();

    const payload = saveSpy.mock.calls[0][0] as AccountTransactionUpdateEvent;
    expect(payload.id).toBe(transaction.id);
    expect(payload.changes.amount).toBe(expected);
    expect(payload.changes.label).toBe('Nouveau libellé');
  });

  it('forces amount back to zero when values are infinite', () => {
    const transaction = createTransaction({ amount: 10 });
    component.transaction = transaction;
    component['editModel'] = {
      date: '2024-02-01',
      label: 'Infinite',
      categoryId: null,
      debit: Number.POSITIVE_INFINITY,
      credit: null,
    };
    component['editing'] = true;
    const saveSpy = jest.spyOn(component.save, 'emit');

    component['onSave']();

    const payload = saveSpy.mock.calls[0][0] as AccountTransactionUpdateEvent;
    expect(payload.changes.amount).toBe(0);
  });

  it('preserves label and category for initial transactions', () => {
    component.transaction = createTransaction({ transactionType: 'INITIAL', label: 'Initial', categoryId: 'root' });
    component['editModel'] = {
      date: '2024-02-02',
      label: 'should be ignored',
      categoryId: 'child',
      debit: null,
      credit: 10,
    };

    const saveSpy = jest.spyOn(component.save, 'emit');
    component['onSave']();

    const payload = saveSpy.mock.calls[0][0] as AccountTransactionUpdateEvent;
    expect(payload.changes.label).toBe('Initial');
    expect(payload.changes.categoryId).toBe('root');
  });

  it('keeps initial transaction category when none is set', () => {
    component.transaction = createTransaction({ transactionType: 'INITIAL', categoryId: null });
    component['editModel'] = {
      date: '2024-02-02',
      label: 'ignored',
      categoryId: 'cat-9',
      debit: null,
      credit: 10,
    };

    const saveSpy = jest.spyOn(component.save, 'emit');
    component['onSave']();

    const payload = saveSpy.mock.calls[0][0] as AccountTransactionUpdateEvent;
    expect(payload.changes.categoryId).toBeNull();
  });

  it('falls back to original label when edit label is empty', () => {
    component.transaction = createTransaction({ label: 'Original' });
    component['editModel'] = {
      date: '2024-02-02',
      label: '   ',
      categoryId: null,
      debit: null,
      credit: 10,
    };

    const saveSpy = jest.spyOn(component.save, 'emit');
    component['onSave']();

    const payload = saveSpy.mock.calls[0][0] as AccountTransactionUpdateEvent;
    expect(payload.changes.label).toBe('Original');
  });

  it('falls back to original label and null category when edit model omits values', () => {
    component.transaction = createTransaction({ label: 'Original label', categoryId: 'cat-1' });
    component['editModel'] = {
      date: '2024-02-02',
      label: undefined as unknown as string,
      categoryId: undefined as unknown as string | null,
      debit: null,
      credit: 10,
    };
    const saveSpy = jest.spyOn(component.save, 'emit');

    component['onSave']();

    const payload = saveSpy.mock.calls[0][0] as AccountTransactionUpdateEvent;
    expect(payload.changes.label).toBe('Original label');
    expect(payload.changes.categoryId).toBeNull();
  });

  it('sanitizes dates when saving', () => {
    component.transaction = createTransaction({ date: '2024-02-10' });
    component['editModel'] = {
      date: 'not a date',
      label: 'Label',
      categoryId: null,
      debit: null,
      credit: null,
    };

    const saveSpy = jest.spyOn(component.save, 'emit');
    component['onSave']();

    expect(saveSpy).toHaveBeenCalledWith({
      id: 'tx-1',
      changes: expect.objectContaining({ date: '2024-02-10' }),
    });
  });

  it('falls back to original date when empty string provided', () => {
    component.transaction = createTransaction({ date: '2024-02-10' });
    component['editModel'] = {
      date: '',
      label: 'Label',
      categoryId: null,
      debit: null,
      credit: null,
    };
    component['editing'] = true;

    const saveSpy = jest.spyOn(component.save, 'emit');
    component['onSave']();

    expect(saveSpy).toHaveBeenCalledWith({
      id: 'tx-1',
      changes: expect.objectContaining({ date: '2024-02-10' }),
    });
  });

  it('falls back to invalid transaction date when edit date is empty', () => {
    component.transaction = createTransaction({ date: 'not-a-date' });
    component['editModel'] = {
      date: '',
      label: 'Label',
      categoryId: null,
      debit: null,
      credit: null,
    };
    const saveSpy = jest.spyOn(component.save, 'emit');

    component['onSave']();

    expect(saveSpy).toHaveBeenCalledWith({
      id: 'tx-1',
      changes: expect.objectContaining({ date: 'not-a-date' }),
    });
  });

  it('uses provided date and trims labels when saving', () => {
    component.transaction = createTransaction({ date: '2024-02-10', label: 'Ancien' });
    component['editModel'] = {
      date: '2024-03-15',
      label: '  Nouveau  ',
      categoryId: 'cat-2',
      debit: null,
      credit: 35,
    };
    component['editing'] = true;

    const saveSpy = jest.spyOn(component.save, 'emit');
    component['onSave']();

    expect(saveSpy).toHaveBeenCalledWith({
      id: 'tx-1',
      changes: expect.objectContaining({ date: '2024-03-15', label: 'Nouveau' }),
    });
  });

  it('creates edit model with empty date when transaction date missing', () => {
    component.transaction = createTransaction({ date: '' });
    component['onDoubleClick']();
    expect(component['editModel']?.date).toBe('');
  });

  it('formatting helpers proxy shared utilities', () => {
    expect(component['formatCurrencyWithSign'](10, false)).toContain('10');
    expect(component['getAmountClass'](5)).toContain('emerald');
  });

  it('converts arbitrary date strings to input format', () => {
    const expected = new Date('March 20 2024').toISOString().slice(0, 10);
    expect(component['toInputDate']('March 20 2024')).toBe(expected);
  });

  it('returns empty input date for invalid strings', () => {
    expect(component['toInputDate']('not-a-date')).toBe('');
  });

  it('sanitizes non-ISO dates to standard format', () => {
    component.transaction = createTransaction({ date: '2024-04-01' });
    component['editModel'] = {
      date: '04/15/2024',
      label: 'Date',
      categoryId: null,
      debit: null,
      credit: null,
    };
    component['editing'] = true;

    const saveSpy = jest.spyOn(component.save, 'emit');
    component['onSave']();

    const expectedDate = new Date('04/15/2024').toISOString().slice(0, 10);

    expect(saveSpy).toHaveBeenCalledWith({
      id: 'tx-1',
      changes: expect.objectContaining({ date: expectedDate }),
    });
  });

  it('falls back to invalid transaction date when edit date is invalid', () => {
    component.transaction = createTransaction({ date: 'invalid-date' });
    component['editModel'] = {
      date: 'not-a-date',
      label: 'Label',
      categoryId: null,
      debit: null,
      credit: null,
    };
    const saveSpy = jest.spyOn(component.save, 'emit');

    component['onSave']();

    expect(saveSpy).toHaveBeenCalledWith({
      id: 'tx-1',
      changes: expect.objectContaining({ date: 'invalid-date' }),
    });
  });
});
