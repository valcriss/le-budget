import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { AccountsMenu } from './accounts-menu';

describe('AccountsMenu', () => {
  let component: AccountsMenu;
  let fixture: ComponentFixture<AccountsMenu>;

  beforeEach(async () => {
    const storeMock = {
      accounts: signal([]),
      loading: signal(false),
      error: signal<string | null>(null),
      saveError: signal<string | null>(null),
      saving: signal(false),
      createAccount: jasmine.createSpy('createAccount').and.resolveTo(undefined),
      clearSaveError: jasmine.createSpy('clearSaveError'),
      defaultCurrency: signal('EUR'),
      getDefaultCurrency: jasmine.createSpy('getDefaultCurrency').and.returnValue('EUR'),
    } satisfies Partial<AccountsStore>;

    await TestBed.configureTestingModule({
      imports: [AccountsMenu],
      providers: [
        { provide: AccountsStore, useValue: storeMock },
        provideAnimations(),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountsMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
