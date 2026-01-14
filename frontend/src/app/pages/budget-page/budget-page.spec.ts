import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { computed, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';

import { BudgetPage } from './budget-page';
import { BudgetStore } from '../../core/budget/budget.store';
import { AccountsStore } from '../../core/accounts/accounts.store';
import { AuthStore } from '../../core/auth/auth.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { BudgetCategory, BudgetMonth } from '../../core/budget/budget.models';
import * as BudgetUtils from '../../core/budget/budget.utils';

class BudgetStoreStub {
  private readonly monthSignal = signal<BudgetMonth | null>(null);
  private readonly groupsSignal = signal<BudgetMonth['groups']>([]);
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

  setMonth(month: BudgetMonth | null) {
    this.monthSignal.set(month);
    this.groupsSignal.set(month?.groups ?? []);
  }

  setMonthKey(key: string | null) {
    this.monthKeySignal.set(key);
  }
}

const baseCategory: BudgetCategory = {
  id: 'cat-1',
  groupId: 'grp-1',
  categoryId: 'category-1',
  category: {
    id: 'category-1',
    name: 'Loisirs',
    kind: 'EXPENSE',
    sortOrder: 0,
    parentCategoryId: null,
    linkedAccountId: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  assigned: 10,
  activity: -5,
  available: 5,
  requiredAmount: 0,
  optimizedAmount: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const createBudgetMonth = (overrides: Partial<BudgetMonth> = {}): BudgetMonth => ({
  id: 'month-1',
  month: '2024-01',
  availableCarryover: 0,
  income: 0,
  assigned: 0,
  activity: 0,
  available: 0,
  totalAssigned: 0,
  totalActivity: 0,
  totalAvailable: 0,
  groups: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('BudgetPage', () => {
  let component: BudgetPage;
  let fixture: ComponentFixture<BudgetPage>;
  let store: BudgetStoreStub;
  let queryParamMap$: Subject<ParamMap>;
  let router: Router;
  let routerNavigate: jest.SpyInstance;

  beforeEach(async () => {
    queryParamMap$ = new Subject<ParamMap>();

    await TestBed.configureTestingModule({
      imports: [BudgetPage],
      providers: [
        provideRouter([]),
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
          useValue: {
            queryParamMap: queryParamMap$.asObservable(),
            snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    }).compileComponents();

    store = TestBed.inject(BudgetStore) as unknown as BudgetStoreStub;
    router = TestBed.inject(Router);
    routerNavigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(BudgetPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    store.loadMonth.mockClear();
    routerNavigate.mockClear();
  });

  afterEach(() => {
    routerNavigate.mockClear();
  });

  it('requests the current month and updates URL when query param missing', async () => {
    const expectedMonth = BudgetUtils.getCurrentMonthKey();

    queryParamMap$.next(convertToParamMap({}));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.loadMonth).toHaveBeenCalledWith(expectedMonth, false);
    expect(routerNavigate).toHaveBeenCalledWith([], {
      relativeTo: expect.any(Object),
      queryParams: { month: expectedMonth },
      replaceUrl: true,
    });
  });

  it('uses query param month without rewriting URL', async () => {
    queryParamMap$.next(convertToParamMap({ month: '2024-04' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.loadMonth).toHaveBeenCalledWith('2024-04', false);
    expect(routerNavigate).not.toHaveBeenCalled();
  });

  it('swallows loadMonth errors when reacting to query param updates', async () => {
    store.loadMonth.mockRejectedValueOnce(new Error('boom'));
    queryParamMap$.next(convertToParamMap({ month: '2024-04' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.loadMonth).toHaveBeenCalledWith('2024-04', false);
  });

  it('passes hasData flag when month already loaded', async () => {
    store.setMonth(createBudgetMonth({ month: '2024-03' }));
    store.setMonthKey('2024-03');
    store.loadMonth.mockClear();

    queryParamMap$.next(convertToParamMap({ month: '2024-03' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.loadMonth).toHaveBeenCalledWith('2024-03', true);
  });

  it('computes month summary with fallback totals', () => {
    const month = createBudgetMonth({
      month: '2024-02',
      availableCarryover: 100,
      income: 300,
      assigned: undefined as unknown as number,
      totalAssigned: 150,
      activity: null as unknown as number,
      totalActivity: 50,
      available: null as unknown as number,
      totalAvailable: 200,
    });
    store.setMonth(month);
    store.setMonthKey('2024-02');

    const summary = component.monthSummary();
    expect(summary).toMatchObject({
      availableCarryover: 100,
      income: 300,
      assigned: 150,
      activity: 50,
      available: 200,
      resourcesTotal: 400,
      totalCharges: 200,
    });
    expect(component.monthLabel()).toBe(BudgetUtils.formatMonthLabel('2024-02'));
  });

  it('derives monthKey from store when month data is missing', () => {
    store.setMonth(null);
    store.setMonthKey('2024-08');
    expect(component.monthKey()).toBe('2024-08');
  });

  it('falls back to current month when no month key is available', () => {
    const currentSpy = jest.spyOn(BudgetUtils, 'getCurrentMonthKey').mockReturnValue('2024-12');
    store.setMonth(null);
    store.setMonthKey(null);

    expect(component.monthKey()).toBe('2024-12');
    currentSpy.mockRestore();
  });

  it('handles category selection and clearing', () => {
    component.onCategorySelected(baseCategory);
    expect(component.selectedCategory()).toBe(baseCategory);

    component.clearSelectedCategory();
    expect(component.selectedCategory()).toBeNull();
  });

  it('navigates to adjacent months', () => {
    store.setMonth(null);
    store.setMonthKey('2024-06');
    const shiftSpy = jest
      .spyOn(BudgetUtils, 'shiftMonthKey')
      .mockReturnValueOnce('2024-05')
      .mockReturnValueOnce('2024-07');

    component.onPreviousMonth();
    component.onNextMonth();

    expect(shiftSpy).toHaveBeenCalledWith('2024-06', -1);
    expect(shiftSpy).toHaveBeenCalledWith('2024-06', 1);
    expect(routerNavigate).toHaveBeenNthCalledWith(1, [], {
      relativeTo: expect.any(Object),
      queryParams: { month: '2024-05' },
      replaceUrl: true,
      queryParamsHandling: 'merge',
    });
    expect(routerNavigate).toHaveBeenNthCalledWith(2, [], {
      relativeTo: expect.any(Object),
      queryParams: { month: '2024-07' },
      replaceUrl: true,
      queryParamsHandling: 'merge',
    });

    shiftSpy.mockRestore();
  });
});
