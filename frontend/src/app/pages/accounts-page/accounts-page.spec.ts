import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { AuthStore } from '../../core/auth/auth.store';

import { AccountsPage } from './accounts-page';

describe('AccountsPage', () => {
  let component: AccountsPage;
  let fixture: ComponentFixture<AccountsPage>;

  beforeEach(async () => {
    const storeMock = {
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
    } satisfies Partial<AccountsStore>;

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
  });
});
