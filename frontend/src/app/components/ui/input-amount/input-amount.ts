import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { formatCurrencyWithSign, toNumber } from '../../../shared/formatters';

@Component({
  selector: 'app-input-amount',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './input-amount.html',
  styleUrls: ['./input-amount.css'],
})
export class InputAmount {
  @Input() value?: string | number;
  @Output() valueChange = new EventEmitter<number>();

  editing = false;
  displayValue = '';

  @ViewChild('amountInput', { read: ElementRef, static: false }) amountInput?: ElementRef<HTMLInputElement>;

  enterEdit() {
    this.editing = true;
    this.displayValue = String(this.value ?? '');
    // focus in next tick
    setTimeout(() => {
      try {
        this.amountInput?.nativeElement.focus();
        this.amountInput?.nativeElement.select();
      } catch (e) {}
    }, 0);
  }

  finishEdit(event?: any) {
    this.editing = false;
    const inputVal = event && event.target ? event.target.value : this.displayValue;
    const n = toNumber(inputVal);
    this.value = n;
    this.valueChange.emit(n);
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this.finishEdit({ target: e.target });
    }
    if (e.key === 'Escape') {
      // cancel edit
      this.editing = false;
    }
  }

  formatCurrencyWithSign(v?: string | number) {
    return formatCurrencyWithSign(v, false);
  }
}
