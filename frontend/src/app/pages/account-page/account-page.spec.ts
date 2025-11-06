import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { computed, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { AuthStore } from '../../core/auth/auth.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { BudgetStore } from '../../core/budget/budget.store';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { AccountPage } from './account-page';

describe('AccountPage', () => {
  let component: AccountPage;
  let fixture: ComponentFixture<AccountPage>;

  beforeEach(async () => {
    const accountsStoreMock = {
      accounts: signal([
        {
          id: 'account-1',
          name: 'Compte courant',
          type: 'checking',
          currentBalance: 1000,
          reconciledBalance: 1000,
          pointedBalance: 900,
          currency: 'EUR',
          archived: false,
        },
      ]),
      loading: signal(false),
      error: signal<string | null>(null),
      totals: computed(() => ({ currentBalance: 1000, reconciledBalance: 1000 })),
      loadAccounts: jest.fn().mockResolvedValue(undefined),
      defaultCurrency: signal('EUR'),
      clearSaveError: jest.fn(),
      createAccount: jest.fn().mockResolvedValue(undefined),
      saveError: signal<string | null>(null),
      hasData: signal(true),
      getDefaultCurrency: jest.fn().mockReturnValue('EUR'),
      updateAccount: jest.fn(),
    } satisfies Partial<AccountsStore>;
    const authStoreMock = {
      logout: jest.fn(),
      user: computed(() => ({ email: 'user@example.com' })),
    } satisfies Partial<AuthStore>;
    const categoriesStoreMock = {
      error: signal<string | null>(null),
      update: jest.fn().mockResolvedValue(undefined),
    } satisfies Partial<CategoriesStore>;
    const budgetStoreMock = {
      reloadCurrentMonth: jest.fn().mockResolvedValue(undefined),
      monthKey: signal('2024-01'),
      updateCategoryAssigned: jest.fn().mockResolvedValue(undefined),
      error: signal<string | null>(null),
    } satisfies Partial<BudgetStore>;
    const transactionsStoreMock = {
      transactions: signal([]),
      loading: signal(false),
      error: signal<string | null>(null),
      load: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn(),
    } satisfies Partial<TransactionsStore>;
    const paramMap = convertToParamMap({ id: 'account-1' });

    await TestBed.configureTestingModule({
      imports: [AccountPage],
      providers: [
        { provide: AccountsStore, useValue: accountsStoreMock },
        { provide: AuthStore, useValue: authStoreMock },
        { provide: CategoriesStore, useValue: categoriesStoreMock },
        { provide: BudgetStore, useValue: budgetStoreMock },
        { provide: TransactionsStore, useValue: transactionsStoreMock },
        { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), snapshot: { paramMap } } },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose addTransactionTrigger starting at zero', () => {
    expect(component['addTransactionTrigger']).toBe(0);
  });

  it('should increment addTransactionTrigger when account menu emits', () => {
    const menu = fixture.debugElement.query(By.css('app-account-menu'));
    expect(menu).not.toBeNull();

    menu!.triggerEventHandler('addTransaction', undefined);
    fixture.detectChanges();

    expect(component['addTransactionTrigger']).toBe(1);
  });
});
