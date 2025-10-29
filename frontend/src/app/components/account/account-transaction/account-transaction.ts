import { Component, Input } from '@angular/core';
import { Checkbox } from '../../ui/checkbox/checkbox';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';

@Component({
  selector: 'app-account-transaction',
  imports: [Checkbox],
  templateUrl: './account-transaction.html',
  styleUrl: './account-transaction.css'
})
export class AccountTransaction {
  // Accept a transaction object from the parent. Provide a safe default so the
  // component can render standalone in stories/tests.
  @Input() transaction: any = {
    date: '29/10/2025',
    label: 'Trésor Public',
    category: 'Catégorie',
    debit: -2500,
    credit: 2500,
    balance: 10000,
  };

  // Expose helpers so templates can call them directly.
  formatCurrencyWithSign(value?: string | number, showPlus = true) {
    return formatCurrencyWithSign(value, showPlus);
  }

  getAmountClass(value?: string | number) {
    return getAmountClass(value);
  }
}
