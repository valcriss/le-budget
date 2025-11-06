import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Header } from './header';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { AuthStore } from '../../../core/auth/auth.store';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  let accountsStoreMock: { accounts: ReturnType<typeof signal> };
  let authStoreMock: { logout: jest.Mock };

  beforeEach(async () => {
    accountsStoreMock = {
      accounts: signal([{ id: 'acc-1' }, { id: 'acc-2' }] as any),
    };
    authStoreMock = {
      logout: jest.fn(),
    };

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

  it('toggles menus and closes them', () => {
    component.toggleMobile();
    component.toggleUser();
    expect(component.mobileOpen()).toBe(true);
    expect(component.userMenuOpen()).toBe(true);

    component.closeMenus();
    expect(component.mobileOpen()).toBe(false);
    expect(component.userMenuOpen()).toBe(false);
  });

  it('computes desktop accounts link', () => {
    const link = (component as any).desktopAccountsLink();
    expect(link).toBe('/accounts/acc-1');
    accountsStoreMock.accounts.set([]);
    expect((component as any).desktopAccountsLink()).toBe('/accounts');
  });

  it('returns default accounts route when store starts empty', async () => {
    accountsStoreMock.accounts.set([]);
    fixture.detectChanges();
    expect((component as any).desktopAccountsLink()).toBe('/accounts');
  });

  it('closes menus on outside click but not inside', () => {
    component.toggleMobile();
    component.toggleUser();
    const outside = new Event('click');
    Object.defineProperty(outside, 'target', { value: document.createElement('div') });
    component.onDocumentClick(outside);
    expect(component.mobileOpen()).toBe(false);
    expect(component.userMenuOpen()).toBe(false);

    component.toggleMobile();
    component.toggleUser();
    const insideTarget = fixture.nativeElement.querySelector('header') || fixture.nativeElement;
    const insideEvent = new Event('click');
    Object.defineProperty(insideEvent, 'target', { value: insideTarget });
    component.onDocumentClick(insideEvent);
    expect(component.mobileOpen()).toBe(true);
    expect(component.userMenuOpen()).toBe(true);
  });

  it('closes menus on Escape key', () => {
    component.toggleMobile();
    component.toggleUser();
    component.onDocumentKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.mobileOpen()).toBe(false);
    expect(component.userMenuOpen()).toBe(false);
  });

  it('calls logout and closes menus', () => {
    component.toggleMobile();
    component.toggleUser();
    component.logout();
    expect(authStoreMock.logout).toHaveBeenCalled();
    expect(component.mobileOpen()).toBe(false);
    expect(component.userMenuOpen()).toBe(false);
  });
});
