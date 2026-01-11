import { Component, signal, HostListener, ElementRef, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { NavItem } from '../nav-item/nav-item';
import { AuthStore } from '../../../core/auth/auth.store';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import {
  faGauge,
  faList,
  faCog,
  faUser,
  faWallet,
  faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, NgIf, FontAwesomeModule, NavItem],
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
})
export class Header {
  // controls for mobile nav and user menu
  mobileOpen = signal(false);
  userMenuOpen = signal(false);
  // icons
  protected readonly icDashboard = faGauge;
  protected readonly icTransactions = faList;
  protected readonly icSettings = faCog;
  protected readonly icAccounts = faWallet;
  protected readonly icLogout = faRightFromBracket;
  protected readonly icUser = faUser;

  toggleMobile() {
    this.mobileOpen.set(!this.mobileOpen());
  }

  toggleUser() {
    this.userMenuOpen.set(!this.userMenuOpen());
  }

  closeMenus() {
    this.mobileOpen.set(false);
    this.userMenuOpen.set(false);
  }

  private readonly accountsStore = inject(AccountsStore);
  protected readonly desktopAccountsLink = computed(() => {
    const list = this.accountsStore.accounts();
    if (!list.length) {
      return '/accounts';
    }
    return `/accounts/${encodeURIComponent(list[0].id)}`;
  });

  /* istanbul ignore next */
  constructor(
    library: FaIconLibrary,
    private el: ElementRef,
    private readonly authStore: AuthStore = inject(AuthStore),
  ) {
    library.addIcons(faGauge, faList, faCog, faUser, faWallet, faRightFromBracket);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as Node;
    if (!this.el.nativeElement.contains(target)) {
      this.closeMenus();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.closeMenus();
    }
  }

  logout() {
    this.closeMenus();
    this.authStore.logout();
  }
}
