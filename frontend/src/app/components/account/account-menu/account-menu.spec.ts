import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { AccountMenu } from './account-menu';
import { AccountsStore } from '../../../core/accounts/accounts.store';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface AccountMock {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
  reconciledBalance: number;
  pointedBalance: number;
  currency: string;
  archived: boolean;
}

describe('AccountMenu', () => {
  let component: AccountMenu;
  let fixture: ComponentFixture<AccountMenu>;
  let accountsSignal: WritableSignal<AccountMock[]>;

  const initialAccounts: AccountMock[] = [
    {
      id: 'account-1',
      name: 'Compte courant',
      type: 'checking',
      currentBalance: 1000,
      reconciledBalance: 1000,
      pointedBalance: 1000,
      currency: 'EUR',
      archived: false,
    },
    {
      id: 'account-2',
      name: 'Compte épargne',
      type: 'savings',
      currentBalance: 1500.345,
      reconciledBalance: 1400.34,
      pointedBalance: 1450.34,
      currency: 'EUR',
      archived: false,
    },
  ];

  const createComponent = () => {
    fixture = TestBed.createComponent(AccountMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    accountsSignal = signal(initialAccounts);

    await TestBed.configureTestingModule({
      imports: [AccountMenu],
      providers: [
        provideRouter([]),
        {
          provide: AccountsStore,
          useValue: {
            accounts: accountsSignal,
          } satisfies Partial<AccountsStore>,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({}) },
          },
        },
      ],
    }).compileComponents();

    createComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('falls back to the first account when route has no id', () => {
    expect(component['account']()?.id).toBe('account-1');
  });

  it('returns null when no route id and no accounts', () => {
    accountsSignal.set([]);
    fixture.detectChanges();

    expect(component['account']()).toBeNull();
  });

  it('selects account from route params and exposes computed helpers', () => {
    fixture.destroy();

    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as Mutable<ActivatedRoute['snapshot']>).paramMap = convertToParamMap({
      id: 'account-2',
    });
    createComponent();

    const account = component['account']();
    expect(account?.id).toBe('account-2');
    expect(component['formatAmount'](100)).toMatch(/100/);
    expect(component['amountClass'](-5)).toContain('text-rose');
    expect(component['shouldShowReconciled']()).toBe(true);
    expect(component['shouldShowPointed']()).toBe(true);
  });

  it('emits addTransaction when triggered', () => {
    const spy = jest.spyOn(component.addTransaction, 'emit');
    component['onAddTransaction']();
    expect(spy).toHaveBeenCalled();
  });

  it('hides reconciled/pointed deltas when balances match', () => {
    accountsSignal.set([
      { ...initialAccounts[0], currentBalance: 10, reconciledBalance: 10, pointedBalance: 10 },
    ]);
    fixture.detectChanges();

    expect(component['shouldShowReconciled']()).toBe(false);
    expect(component['shouldShowPointed']()).toBe(false);
  });
  it('returns null account when route id missing from store', () => {
    fixture.destroy();
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as Mutable<ActivatedRoute['snapshot']>).paramMap = convertToParamMap({
      id: 'absent',
    });
    accountsSignal.set([{ ...initialAccounts[0] }]);
    createComponent();

    expect(component['account']()).toBeNull();
    expect(component['shouldShowReconciled']()).toBe(false);
    expect(component['shouldShowPointed']()).toBe(false);
  });

});
