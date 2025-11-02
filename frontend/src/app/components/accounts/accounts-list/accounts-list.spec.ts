import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { AccountsList } from './accounts-list';

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

    await TestBed.configureTestingModule({
      imports: [AccountsList],
      providers: [
        { provide: AccountsStore, useValue: storeMock },
        provideRouter([]),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
