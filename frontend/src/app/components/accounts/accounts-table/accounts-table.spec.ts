import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { AccountsTable } from './accounts-table';
import { Account } from '../../../core/accounts/accounts.models';

type SignalAccessor<T> = {
  (): T;
  set(value: T): void;
};

type AccountsTableHarness = AccountsTable & {
  dialogOpen: SignalAccessor<boolean>;
  dialogSubmitting: SignalAccessor<boolean>;
  dialogError: SignalAccessor<string | null>;
  dialogInitialValue: SignalAccessor<{ id: string; name: string; type: Account['type'] } | null>;
  openEditDialog(account: Account): void;
  closeDialog(): void;
  handleUpdate(payload: { name: string; type: Account['type']; initialBalance?: number }): Promise<void>;
  iconFor(account: Account): unknown;
  icChecking: unknown;
  icSavings: unknown;
};

describe('AccountsTable', () => {
  let fixture: ComponentFixture<AccountsTable>;
  let component: AccountsTable;
  let storeMock: {
    updateAccount: jest.Mock;
    saveError: jest.Mock;
  };

  const account: Account = {
    id: 'acc-1',
    name: 'Checking',
    type: 'CHECKING',
    currency: 'EUR',
    initialBalance: 0,
    currentBalance: 0,
    reconciledBalance: 0,
    pointedBalance: 0,
    archived: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  beforeEach(async () => {
    storeMock = {
      updateAccount: jest.fn().mockResolvedValue({ id: 'acc-1' }),
      saveError: jest.fn(() => null),
    };

    await TestBed.configureTestingModule({
      imports: [AccountsTable],
      providers: [
        {
          provide: AccountsStore,
          useValue: {
            accounts: signal([account]),
            loading: signal(false),
            error: signal<string | null>(null),
            totals: computed(() => ({ currentBalance: 0, reconciledBalance: 0 })),
            defaultCurrency: signal('EUR'),
            updateAccount: storeMock.updateAccount,
            saveError: storeMock.saveError,
          } satisfies Partial<AccountsStore>,
        },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountsTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const harness = () => component as unknown as AccountsTableHarness;

  function readSignal<T extends keyof Pick<
    AccountsTableHarness,
    'dialogOpen' | 'dialogSubmitting' | 'dialogError' | 'dialogInitialValue'
  >>(name: T) {
    return harness()[name]();
  }

  it('opens and closes the edit dialog', () => {
    const instance = harness();
    instance.openEditDialog(account);
    expect(readSignal('dialogOpen')).toBe(true);
    expect(readSignal('dialogInitialValue')).toEqual({
      id: 'acc-1',
      name: 'Checking',
      type: 'CHECKING',
    });

    instance.closeDialog();
    expect(readSignal('dialogOpen')).toBe(false);

    instance.openEditDialog(account);
    instance.dialogSubmitting.set(true);
    instance.closeDialog();
    expect(readSignal('dialogOpen')).toBe(true);
  });

  it('ignores updates when no dialog context', async () => {
    await harness().handleUpdate({ name: 'Updated', type: 'SAVINGS' });
    expect(storeMock.updateAccount).not.toHaveBeenCalled();
  });

  it('updates an account successfully and closes dialog', async () => {
    const instance = harness();
    instance.openEditDialog(account);
    await instance.handleUpdate({ name: 'Updated', type: 'SAVINGS' });

    expect(storeMock.updateAccount).toHaveBeenCalledWith('acc-1', {
      name: 'Updated',
      type: 'SAVINGS',
    });
    expect(readSignal('dialogOpen')).toBe(false);
    expect(readSignal('dialogSubmitting')).toBe(false);
  });

  it('surfaces store-provided error messages', async () => {
    const instance = harness();
    instance.openEditDialog(account);
    storeMock.updateAccount.mockRejectedValueOnce(new Error('fail'));
    storeMock.saveError.mockReturnValueOnce('Update failed');

    await instance.handleUpdate({ name: 'Updated', type: 'CHECKING' });

    expect(readSignal('dialogError')).toBe('Update failed');
    expect(readSignal('dialogSubmitting')).toBe(false);
  });

  it('falls back to error message when store silent', async () => {
    const instance = harness();
    instance.openEditDialog(account);
    storeMock.updateAccount.mockRejectedValueOnce(new Error('boom'));
    storeMock.saveError.mockReturnValueOnce(null);

    await instance.handleUpdate({ name: 'Updated', type: 'CHECKING' });

    expect(readSignal('dialogError')).toBe('boom');
  });

  it('maps account types to icons', () => {
    const instance = harness();
    const checkingIcon = instance.iconFor(account);
    const savingsIcon = instance.iconFor({ ...account, type: 'SAVINGS' });
    expect(checkingIcon).toBe(instance.icChecking);
    expect(savingsIcon).toBe(instance.icSavings);
  });
});
