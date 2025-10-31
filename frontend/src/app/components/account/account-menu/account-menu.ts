import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare, faPlusSquare } from '@fortawesome/free-solid-svg-icons';
import { AccountsStore } from '../../../core/accounts/accounts.store';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';
@Component({
  selector: 'app-account-menu',
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './account-menu.html',
  styleUrl: './account-menu.css'
})
export class AccountMenu {

  protected readonly icEditAccount = faPenToSquare;
  protected readonly icTransactionAdd = faPlusSquare;
  private readonly accountsStore = inject(AccountsStore);
  private readonly route = inject(ActivatedRoute);

  private readonly accountId = computed(() => this.route.snapshot.paramMap.get('id'));
  protected readonly account = computed(() => {
    const id = this.accountId();
    if (!id) {
      return this.accountsStore.accounts()[0] ?? null;
    }
    return this.accountsStore.accounts().find((acc) => acc.id === id) ?? null;
  });

  protected readonly formatAmount = (value?: string | number) => formatCurrencyWithSign(value, false);
  protected readonly amountClass = (value?: string | number) => getAmountClass(value);
  protected readonly shouldShowReconciled = computed(() => {
    const acc = this.account();
    if (!acc) return false;
    return this.roundToCents(acc.currentBalance) !== this.roundToCents(acc.reconciledBalance);
  });

  protected readonly shouldShowPointed = computed(() => {
    const acc = this.account();
    if (!acc) return false;
    return this.roundToCents(acc.pointedBalance) !== this.roundToCents(acc.reconciledBalance);
  });

  constructor(library: FaIconLibrary) {
    library.addIcons(faPenToSquare, faPlusSquare);
  }

  private roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
  }

}
