import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { AuthStore } from '../../core/auth/auth.store';

import { AccountsPage } from './accounts-page';

describe('AccountsPage', () => {
  let component: AccountsPage;
  let fixture: ComponentFixture<AccountsPage>;
  let storeMock: {
    accounts: ReturnType<typeof signal>;
    loading: ReturnType<typeof signal>;
    error: ReturnType<typeof signal>;
    totals: ReturnType<typeof computed>;
    loadAccounts: jest.Mock;
    defaultCurrency: ReturnType<typeof signal>;
    clearSaveError: jest.Mock;
    createAccount: jest.Mock;
    saveError: ReturnType<typeof signal>;
    hasData: ReturnType<typeof signal>;
    getDefaultCurrency: jest.Mock;
    updateAccount: jest.Mock;
  };

  beforeEach(async () => {
    storeMock = {
      accounts: signal([]),
      loading: signal(false),
      error: signal<string | null>(null),
      totals: computed(() => ({ currentBalance: 0, reconciledBalance: 0 })),
      loadAccounts: jest.fn().mockResolvedValue(undefined),
      defaultCurrency: signal('EUR'),
      clearSaveError: jest.fn(),
      createAccount: jest.fn().mockResolvedValue(undefined),
      saveError: signal<string | null>(null),
      hasData: signal(false),
      getDefaultCurrency: jest.fn().mockReturnValue('EUR'),
      updateAccount: jest.fn(),
    } satisfies Partial<AccountsStore> as typeof storeMock;

    const authStoreMock = {
      logout: jest.fn(),
      user: computed(() => ({ email: 'user@example.com' })),
    } satisfies Partial<AuthStore>;

    await TestBed.configureTestingModule({
      imports: [AccountsPage],
      providers: [
        { provide: AccountsStore, useValue: storeMock },
        { provide: AuthStore, useValue: authStoreMock },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(storeMock.loadAccounts).toHaveBeenCalledTimes(1);
  });

  it('catches load errors without throwing', async () => {
    storeMock.loadAccounts.mockRejectedValueOnce(new Error('fail'));

    fixture = TestBed.createComponent(AccountsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();

    expect(storeMock.loadAccounts).toHaveBeenCalledTimes(2);
  });
});
