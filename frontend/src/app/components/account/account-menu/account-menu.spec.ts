import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { AccountMenu } from './account-menu';
import { AccountsStore } from '../../../core/accounts/accounts.store';

describe('AccountMenu', () => {
  let component: AccountMenu;
  let fixture: ComponentFixture<AccountMenu>;

  beforeEach(async () => {
    const storeMock = {
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

    await TestBed.configureTestingModule({
      imports: [AccountMenu],
      providers: [
        { provide: AccountsStore, useValue: storeMock },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
