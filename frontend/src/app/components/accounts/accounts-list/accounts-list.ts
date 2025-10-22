import { Component } from '@angular/core';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';

@Component({
  selector: 'app-accounts-list',
  imports: [],
  templateUrl: './accounts-list.html',
  styleUrl: './accounts-list.css'
})
export class AccountsList {

  // Expose the formatter functions to the template
  formatCurrencyWithSign(value?: string | number) {
    return formatCurrencyWithSign(value, false);
  }

  getAmountClass(value?: string | number) {
    return getAmountClass(value);
  }

}
