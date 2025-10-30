import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { AccountsTable } from './accounts-table';

describe('AccountsTable', () => {
  let component: AccountsTable;
  let fixture: ComponentFixture<AccountsTable>;

  beforeEach(async () => {
    const storeMock = {
      accounts: signal([]),
      loading: signal(false),
      error: signal<string | null>(null),
      totals: computed(() => ({ currentBalance: 0, reconciledBalance: 0 })),
      loadAccounts: jasmine.createSpy('loadAccounts'),
    } satisfies Partial<AccountsStore>;

    await TestBed.configureTestingModule({
      imports: [AccountsTable],
      providers: [
        { provide: AccountsStore, useValue: storeMock },
        provideRouter([]),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountsTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
