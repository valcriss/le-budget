import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter, ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { AccountsList } from './accounts-list';
import { Subject } from 'rxjs';

describe('AccountsList', () => {
  let component: AccountsList;
  let fixture: ComponentFixture<AccountsList>;

  beforeEach(async () => {
    const storeMock = {
      accounts: signal([]),
      loading: signal(false),
      error: signal<string | null>(null),
      totals: computed(() => ({ currentBalance: 0, reconciledBalance: 0 })),
      loadAccounts: jest.fn().mockName('loadAccounts').mockResolvedValue(undefined),
      hasData: signal(false),
      defaultCurrency: signal('EUR'),
      getDefaultCurrency: jest.fn().mockName('getDefaultCurrency').mockReturnValue('EUR'),
      createAccount: jest.fn().mockName('createAccount').mockResolvedValue(undefined),
      saveError: signal<string | null>(null),
    } satisfies Partial<AccountsStore>;

    const paramMap$ = new Subject<ParamMap>();

    await TestBed.configureTestingModule({
      imports: [AccountsList],
      providers: [
        provideRouter([]),
        { provide: AccountsStore, useValue: storeMock },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$, snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    })
    .compileComponents();

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
});
