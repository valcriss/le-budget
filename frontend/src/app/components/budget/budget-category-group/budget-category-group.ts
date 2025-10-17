import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlusSquare, faChevronRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';
import { BudgetCategoryItem } from '../budget-category-item/budget-category-item';

@Component({
  selector: 'app-budget-category-group',
  imports: [FontAwesomeModule, BudgetCategoryItem],
  templateUrl: './budget-category-group.html',
  styleUrls: ['./budget-category-group.css'],
})
export class BudgetCategoryGroup {
  protected readonly icChevronRight = faChevronRight;
  protected readonly icChevronDown = faChevronDown;
  protected readonly icAdd = faPlusSquare;

  @Input() label?: string;
  @Input() assigned?: number | string;
  @Input() paid?: number | string;
  @Input() available?: number | string;
  @Output() addCategory = new EventEmitter<void>();

  constructor(library: FaIconLibrary) {
    library.addIcons(faChevronRight, faChevronDown, faPlusSquare);
  }

  // collapsed state: true = collapsed (content hidden)
  collapsed = false;

  // animation state to prevent re-entrant toggles
  private animating = false;

  @ViewChild('content') private contentEl?: ElementRef<HTMLElement>;

  toggleCollapsed(event?: MouseEvent){
    event?.stopPropagation();
    // don't toggle while animating
    if (this.animating) return;
    // animateToggle expects `open` = true when we want to open the content.
    // If `collapsed` is true the content is closed, so `open` should be true.
    this.animateToggle(this.collapsed);
  }

  private animateToggle(open: boolean) {
    const el = this.contentEl?.nativeElement;
    if (!el) {
      // fallback: just flip state
      this.collapsed = !open ? true : false;
      return;
    }

    this.animating = true;

    if (open) {
      // opening: start from height 0 -> to scrollHeight
      el.style.height = '0px';
      // reveal inner content visually (opacity/transform) so nested component hosts are visible
      const inner = el.querySelector('.collapse-inner') as HTMLElement | null;
      if (inner) {
        inner.style.transition = 'transform 220ms cubic-bezier(.2,.9,.2,1), opacity 200ms ease';
        inner.style.opacity = '0';
        inner.style.transform = 'translateY(-6px)';
      }
      // ensure the DOM paints with initial height
      requestAnimationFrame(() => {
        const target = el.scrollHeight;
        el.style.transition = 'height 300ms cubic-bezier(.2,.9,.2,1)';
        el.style.height = target + 'px';
        if (inner) {
          // animate inner to visible at the same time
          inner.style.opacity = '1';
          inner.style.transform = 'translateY(0)';
        }
      });
      const onEnd = (ev?: Event) => {
        el.style.height = '';
        el.style.transition = '';
        el.removeEventListener('transitionend', onEnd);
        this.collapsed = false;
        this.animating = false;
      };
      el.addEventListener('transitionend', onEnd);
    } else {
      // closing: from current height -> 0
      const inner = el.querySelector('.collapse-inner') as HTMLElement | null;
      // start by hiding inner content visually
      if (inner) {
        inner.style.transition = 'transform 220ms cubic-bezier(.2,.9,.2,1), opacity 200ms ease';
        inner.style.opacity = '0';
        inner.style.transform = 'translateY(-6px)';
      }
      const start = el.scrollHeight;
      el.style.height = start + 'px';
      // then collapse to 0
      requestAnimationFrame(() => {
        el.style.transition = 'height 300ms cubic-bezier(.2,.9,.2,1)';
        el.style.height = '0px';
      });
      const onEnd = (ev?: Event) => {
        // Keep the height explicitly at 0 so the container doesn't snap back
        // to an auto height after the inner content was hidden (opacity:0).
        el.style.height = '0px';
        el.style.transition = '';
        el.style.overflow = 'hidden';
        el.removeEventListener('transitionend', onEnd);
        this.collapsed = true;
        this.animating = false;
      };
      el.addEventListener('transitionend', onEnd);
    }
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
