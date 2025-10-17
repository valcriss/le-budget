import { Component, Input } from '@angular/core';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlusSquare, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { InputAmount } from '../../ui/input-amount/input-amount';
import { BadgeAmount } from '../../ui/badge-amount/badge-amount';

@Component({
  selector: 'app-budget-category-item',
  standalone: true,
  imports: [FontAwesomeModule, InputAmount, BadgeAmount],
  templateUrl: './budget-category-item.html',
  styleUrls: ['./budget-category-item.css'],
})
export class BudgetCategoryItem {
  protected readonly icChevronRight = faChevronRight;
  protected readonly icAdd = faPlusSquare;

  @Input() label?: string;
  @Input() assigned?: number | string;
  @Input() paid?: number | string;
  @Input() available?: number | string;

  constructor(library: FaIconLibrary) {
    library.addIcons(faChevronRight, faPlusSquare);
  }

  onAssignedChange(n: number) {
    this.assigned = n;
  }

  formatCurrencyWithSign(value?: string | number) {
    return formatCurrencyWithSign(value, false);
  }

  getAvailableClass(value?: string | number) {
    return getAmountClass(value);
  }
}
