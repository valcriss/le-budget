import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal, WritableSignal } from '@angular/core';
import { provideRouter, ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { AccountsList } from './accounts-list';
import { Subject } from 'rxjs';
import { formatCurrencyWithSign } from '../../../shared/formatters';

describe('AccountsList', () => {
  let component: AccountsList;
  let fixture: ComponentFixture<AccountsList>;
  let storeMock: {
    accounts: ReturnType<typeof signal>;
    loading: ReturnType<typeof signal>;
    error: ReturnType<typeof signal>;
    totals: ReturnType<typeof computed>;
    loadAccounts: jest.Mock;
    hasData: ReturnType<typeof signal>;
    defaultCurrency: ReturnType<typeof signal>;
    getDefaultCurrency: jest.Mock;
    createAccount: jest.Mock;
    clearSaveError: jest.Mock;
    saveError: WritableSignal<string | null>;
  };
  let saveErrorSignal: WritableSignal<string | null>;
  let paramMap$: Subject<ParamMap>;

  beforeEach(async () => {
    saveErrorSignal = signal<string | null>(null);
    storeMock = {
      accounts: signal([]),
      loading: signal(false),
      error: signal<string | null>(null),
      totals: computed(() => ({ currentBalance: 0, reconciledBalance: 0 })),
      loadAccounts: jest.fn().mockName('loadAccounts').mockResolvedValue(undefined),
      hasData: signal(false),
      defaultCurrency: signal('EUR'),
      getDefaultCurrency: jest.fn().mockName('getDefaultCurrency').mockReturnValue('EUR'),
      createAccount: jest.fn().mockName('createAccount').mockResolvedValue(undefined),
      clearSaveError: jest.fn().mockName('clearSaveError'),
      saveError: saveErrorSignal,
    };

    paramMap$ = new Subject<ParamMap>();

    await TestBed.configureTestingModule({
      imports: [AccountsList],
      providers: [
        provideRouter([]),
        { provide: AccountsStore, useValue: storeMock },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMap$, snapshot: { paramMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('updates highlightedAccountId when route paramMap changes', () => {
    const activatedRoute = TestBed.inject(ActivatedRoute) as unknown as { paramMap: Subject<ParamMap> };
    // initially null
    expect(component['highlightedAccountId']()).toBeNull();

    // emit a new paramMap
    activatedRoute.paramMap.next(convertToParamMap({ id: 'account-1' }));
    fixture.detectChanges();

    expect(component['highlightedAccountId']()).toBe('account-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads accounts on init', () => {
    expect(storeMock.loadAccounts).toHaveBeenCalled();
  });

  it('formats amounts using the shared formatter', () => {
    expect(component['formatAmount'](100)).toBe(formatCurrencyWithSign(100, false));
  });

  it('opens and closes the creation dialog', () => {
    component['dialogError'].set('Oops');
    component['dialogSubmitting'].set(true);

    component['openDialog']();

    expect(storeMock.clearSaveError).toHaveBeenCalled();
    expect(component['dialogError']()).toBeNull();
    expect(component['dialogSubmitting']()).toBe(false);
    expect(component['dialogOpen']()).toBe(true);

    component['dialogSubmitting'].set(true);
    component['closeDialog']();
    expect(component['dialogOpen']()).toBe(true);

    component['dialogSubmitting'].set(false);
    component['closeDialog']();
    expect(component['dialogOpen']()).toBe(false);
  });

  it('does not start creation if already submitting', async () => {
    component['dialogSubmitting'].set(true);
    await component['handleCreate']({ name: 'Compte', type: 'CHECKING', initialBalance: 10 });

    expect(storeMock.createAccount).not.toHaveBeenCalled();
  });

  it('creates a new account and closes the dialog', async () => {
    component['dialogOpen'].set(true);

    await component['handleCreate']({ name: 'Compte', type: 'SAVINGS', initialBalance: 5 });

    expect(storeMock.createAccount).toHaveBeenCalledWith({
      name: 'Compte',
      type: 'SAVINGS',
      initialBalance: 5,
      reconciledBalance: 5,
      currency: 'EUR',
    });
    expect(storeMock.clearSaveError).toHaveBeenCalledTimes(1);
    expect(component['dialogOpen']()).toBe(false);
    expect(component['dialogSubmitting']()).toBe(false);
  });

  it('shows store error message when creation fails', async () => {
    storeMock.createAccount.mockRejectedValueOnce(new Error('backend'));
    saveErrorSignal.set('Erreur API');

    await component['handleCreate']({ name: 'Compte', type: 'CHECKING' });

    expect(component['dialogError']()).toBe('Erreur API');
    expect(component['dialogSubmitting']()).toBe(false);
  });

  it('uses thrown error message when store has none', async () => {
    storeMock.createAccount.mockRejectedValueOnce(new Error('Erreur inattendue'));
    saveErrorSignal.set(null);

    await component['handleCreate']({ name: 'Compte', type: 'CHECKING' });

    expect(component['dialogError']()).toBe('Erreur inattendue');
  });

  it('falls back to default error message when none available', async () => {
    storeMock.createAccount.mockRejectedValueOnce('kaput');
    saveErrorSignal.set(null);

    await component['handleCreate']({ name: 'Compte', type: 'CHECKING' });

    expect(component['dialogError']()).toBe('Impossible de créer le compte.');
  });
});
