import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlusSquare } from '@fortawesome/free-solid-svg-icons';
import { CurrencyPipe } from '@angular/common';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-budget-category-group',
  imports: [FontAwesomeModule],
  templateUrl: './budget-category-group.html',
  styleUrl: './budget-category-group.css',
})
export class BudgetCategoryGroup {
  protected readonly icChevronRight = faChevronRight;
  protected readonly icAdd = faPlusSquare;

  @Input() label?: string;
  @Input() assigned?: number | string;
  @Input() paid?: number | string;
  @Input() available?: number | string;
  @Output() addCategory = new EventEmitter<void>();

  constructor(library: FaIconLibrary) {
    library.addIcons(faChevronRight, faPlusSquare);
  }

  // wrappers for template usage
  fmt(value?: string | number) {
    return formatCurrencyWithSign(value);
  }

  amountClass(value?: string | number) {
    return getAmountClass(value);
  }

  // same names as BudgetStatus for consistency
  formatCurrencyWithSign(value?: string | number) {
    return formatCurrencyWithSign(value, false);
  }

  getAvailableClass(value?: string | number) {
    return getAmountClass(value);
  }

  onAddCategory(event?: MouseEvent) {
    // prevent parent row handlers from receiving the click
    event?.stopPropagation();
    this.addCategory.emit();
  }
}
