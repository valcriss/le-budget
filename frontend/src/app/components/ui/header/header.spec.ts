import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { AuthStore } from '../../../core/auth/auth.store';

import { Header } from './header';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    const accountsStoreMock = {
      accounts: signal([
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
      ]),
    } satisfies Partial<AccountsStore>;
    const authStoreMock = {
      logout: jest.fn(),
      user: computed(() => ({ email: 'user@example.com' })),
    } satisfies Partial<AuthStore>;

    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        { provide: AccountsStore, useValue: accountsStoreMock },
        { provide: AuthStore, useValue: authStoreMock },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
