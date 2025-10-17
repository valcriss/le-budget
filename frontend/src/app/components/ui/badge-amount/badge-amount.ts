import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCurrencyWithSign, toNumber } from '../../../shared/formatters';

@Component({
  selector: 'app-badge-amount',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badge-amount.html',
  styleUrls: ['./badge-amount.css'],
})
export class BadgeAmount {
  @Input() amount?: number | string;
  @Input() needed?: number | string;

  get bgClass(): string {
    const a = toNumber(this.amount);
    const n = toNumber(this.needed);
    if (a < 0) return 'bg-rose-400 hover:bg-rose-500';
    if (a === 0 && n === 0) return 'bg-gray-400 hover:bg-gray-500';
    if (a > 0 && a >= n) return 'bg-emerald-400 hover:bg-emerald-500';
    if (a > 0 && a < n) return 'bg-yellow-400 hover:bg-yellow-500';
    return 'bg-gray-400 hover:bg-gray-500';
  }

  formatted(): string {
    // use formatCurrencyWithSign but without plus sign
    return formatCurrencyWithSign(this.amount, false);
  }
}
