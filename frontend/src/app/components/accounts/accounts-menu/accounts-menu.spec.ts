import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { AccountsMenu } from './accounts-menu';
import { CreateAccountInput } from '../../../core/accounts/accounts.models';

type SignalAccessor<T> = {
  (): T;
  set(value: T): void;
};

type AccountsMenuHarness = AccountsMenu & {
  dialogOpen: SignalAccessor<boolean>;
  submitting: SignalAccessor<boolean>;
  dialogError: SignalAccessor<string | null>;
  openDialog(): void;
  closeDialog(): void;
  handleCreateAccount(
    payload: Omit<CreateAccountInput, 'currency' | 'reconciledBalance' | 'archived'>,
  ): Promise<void>;
};

describe('AccountsMenu', () => {
  let component: AccountsMenu;
  let fixture: ComponentFixture<AccountsMenu>;
  let storeMock: {
    createAccount: jest.Mock;
    clearSaveError: jest.Mock;
    defaultCurrency: jest.Mock;
    saveError: jest.Mock;
  };

  beforeEach(async () => {
    storeMock = {
      createAccount: jest.fn().mockResolvedValue(undefined),
      clearSaveError: jest.fn(),
      defaultCurrency: jest.fn(() => 'EUR'),
      saveError: jest.fn(() => null),
    };

    await TestBed.configureTestingModule({
      imports: [AccountsMenu],
      providers: [
        { provide: AccountsStore, useValue: storeMock },
        provideAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountsMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const harness = () => component as unknown as AccountsMenuHarness;

  function readSignal(name: 'dialogOpen' | 'submitting' | 'dialogError') {
    return harness()[name]();
  }

  it('opens the dialog and clears store state', () => {
    harness().openDialog();
    expect(storeMock.clearSaveError).toHaveBeenCalled();
    expect(readSignal('dialogOpen')).toBe(true);
    expect(readSignal('dialogError')).toBeNull();
  });

  it('closes the dialog unless submitting', () => {
    const instance = harness();
    instance.openDialog();
    instance.closeDialog();
    expect(readSignal('dialogOpen')).toBe(false);

    instance.openDialog();
    instance.submitting.set(true);
    instance.closeDialog();
    expect(readSignal('dialogOpen')).toBe(true);
  });

  it('creates an account with default currency and closes dialog', async () => {
    const payload = { name: 'Test', type: 'CHECKING', initialBalance: 42 } as CreateAccountInput;
    const instance = harness();
    instance.openDialog();

    await instance.handleCreateAccount(payload);

    expect(storeMock.createAccount).toHaveBeenCalledWith({
      name: 'Test',
      type: 'CHECKING',
      initialBalance: 42,
      reconciledBalance: 42,
      currency: 'EUR',
    });
    expect(storeMock.clearSaveError).toHaveBeenLastCalledWith();
    expect(readSignal('dialogOpen')).toBe(false);
    expect(readSignal('submitting')).toBe(false);
  });

  it('defaults initial balance to zero when omitted', async () => {
    const payload = { name: 'Zero', type: 'CHECKING' } as CreateAccountInput;
    const instance = harness();
    instance.openDialog();

    await instance.handleCreateAccount(payload);

    expect(storeMock.createAccount).toHaveBeenCalledWith({
      name: 'Zero',
      type: 'CHECKING',
      initialBalance: 0,
      reconciledBalance: 0,
      currency: 'EUR',
    });
  });

  it('surfaces store error messages when creation fails', async () => {
    const error = new Error('boom');
    storeMock.createAccount.mockRejectedValueOnce(error);
    storeMock.saveError.mockReturnValueOnce('Store says no');

    await harness().handleCreateAccount({ name: 'X', type: 'CHECKING', initialBalance: 0 });

    expect(readSignal('dialogError')).toBe('Store says no');
    expect(readSignal('submitting')).toBe(false);
  });

  it('falls back to generic error when store provides none', async () => {
    storeMock.createAccount.mockRejectedValueOnce(new Error('boom'));
    storeMock.saveError.mockReturnValueOnce(null);

    await harness().handleCreateAccount({ name: 'Y', type: 'CHECKING', initialBalance: 0 });

    expect(readSignal('dialogError')).toBe('boom');
  });

  it('uses generic error message when no store or error details exist', async () => {
    storeMock.createAccount.mockRejectedValueOnce({ code: 'unknown' });
    storeMock.saveError.mockReturnValueOnce(null);

    await harness().handleCreateAccount({ name: 'Z', type: 'CHECKING', initialBalance: 0 });

    expect(readSignal('dialogError')).toBe('Impossible de créer le compte.');
  });

  it('ignores duplicate submissions while submitting', async () => {
    const instance = harness();
    instance.submitting.set(true);
    await instance.handleCreateAccount({ name: 'Nope', type: 'CHECKING', initialBalance: 0 });
    expect(storeMock.createAccount).toHaveBeenCalledTimes(0);
  });
});
