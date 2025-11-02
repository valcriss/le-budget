import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { computed, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';

import { BudgetPage } from './budget-page';
import { BudgetStore } from '../../core/budget/budget.store';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { AuthStore } from '../../core/auth/auth.store';
import { CategoriesStore } from '../../core/categories/categories.store';

class BudgetStoreStub {
  private readonly monthSignal = signal<any>(null);
  private readonly groupsSignal = signal<any[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly monthKeySignal = signal<string | null>(null);

  readonly month = this.monthSignal.asReadonly();
  readonly groups = this.groupsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly monthKey = this.monthKeySignal.asReadonly();
  readonly hasData = computed(() => this.monthSignal() !== null);

  loadMonth = jest.fn().mockName('loadMonth').mockResolvedValue(undefined);
  reloadCurrentMonth = jest.fn().mockResolvedValue(undefined);
  updateCategoryAssigned = jest.fn().mockResolvedValue(undefined);
  clearError = jest.fn();
}

describe('BudgetPage', () => {
  let component: BudgetPage;
  let fixture: ComponentFixture<BudgetPage>;
  let store: BudgetStoreStub;
  let queryParamMap$: Subject<ParamMap>;

  beforeEach(async () => {
    queryParamMap$ = new Subject<ParamMap>();

    await TestBed.configureTestingModule({
      imports: [BudgetPage],
      providers: [
        { provide: BudgetStore, useClass: BudgetStoreStub },
        {
          provide: AccountsStore,
          useValue: {
            accounts: signal([]),
            defaultCurrency: signal('EUR'),
            loadAccounts: jest.fn(),
            clearSaveError: jest.fn(),
            createAccount: jest.fn(),
            saveError: signal<string | null>(null),
            hasData: signal(false),
            getDefaultCurrency: jest.fn().mockReturnValue('EUR'),
            updateAccount: jest.fn(),
          } satisfies Partial<AccountsStore>,
        },
        {
          provide: AuthStore,
          useValue: {
            logout: jest.fn(),
            user: computed(() => ({ email: 'user@example.com' })),
          } satisfies Partial<AuthStore>,
        },
        {
          provide: CategoriesStore,
          useValue: {
            error: signal<string | null>(null),
            update: jest.fn().mockResolvedValue(undefined),
          } satisfies Partial<CategoriesStore>,
        },
        {
          provide: Dialog,
          useValue: { open: jest.fn() },
        },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParamMap$.asObservable() },
        },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetPage);
    component = fixture.componentInstance;
    store = TestBed.inject(BudgetStore) as unknown as BudgetStoreStub;
  });

  it('should create and request the current month when no query param is provided', async () => {
    queryParamMap$.next(convertToParamMap({}));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component).toBeTruthy();
    expect(store.loadMonth).toHaveBeenCalled();
  });
});
