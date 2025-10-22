import { Component, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CommonModule } from '@angular/common';
import { faChevronRight, faPlusSquare } from '@fortawesome/free-solid-svg-icons';
import { BUDGET_TEST_DATA, BudgetCategoryGroupData } from '../test-data/budget-test-data';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';
import { InputAmount } from '../../ui/input-amount/input-amount';
import { BadgeAmount } from '../../ui/badge-amount/badge-amount';

@Component({
  selector: 'app-budget-categories',
  imports: [CommonModule, FontAwesomeModule, InputAmount, BadgeAmount, DragDropModule],
  templateUrl: './budget-categories.html',
  styleUrl: './budget-categories.css',
})
export class BudgetCategories {
  protected readonly icChevronRight = faChevronRight;
  protected readonly icAdd = faPlusSquare;

  constructor(library: FaIconLibrary) {
  library.addIcons(faChevronRight, faPlusSquare);
  }

  // groups with test data; we augment each group with UI state below
  groups: Array<BudgetCategoryGroupData & { collapsed?: boolean; animating?: boolean }> = [];

  ngOnInit() {
    // clone the test data so we can add UI state safely
    this.groups = BUDGET_TEST_DATA.map(g => ({ ...g, collapsed: false, animating: false }));
  }

  // references to the content containers for each group (one per ngFor)
  @ViewChildren('contentEl') contentEls!: QueryList<ElementRef<HTMLElement>>;

  // helper formatters (used by template)
  formatCurrencyWithSign(value?: string | number) {
    return formatCurrencyWithSign(value, false);
  }

  getAmountClass(value?: string | number) {
    return getAmountClass(value);
  }

  // toggle collapse for group index (uses height-based animation)
  toggleGroup(index: number, event?: MouseEvent) {
    event?.stopPropagation();
    const g = this.groups[index];
    if (!g || g.animating) return;
    // find the matching content element from the QueryList
    const arr = this.contentEls ? this.contentEls.toArray() : [];
    const elRef = arr[index];
    const el = elRef ? elRef.nativeElement : undefined;
    // animateToggle expects `open` = true when we want to open the content.
    // If `collapsed` is true the content is closed, so `open` should be true.
    this.animateToggle(el, g, !!g.collapsed);
  }

  // drag & drop handlers
  dropGroup(event: CdkDragDrop<any[]>) {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.groups, event.previousIndex, event.currentIndex);
  }

  dropItem(event: CdkDragDrop<any[]>, targetGroupIndex: number) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      // recalc totals for the affected group
      this.recalcGroupTotals(targetGroupIndex);
    } else {
      // moving between groups
      const prevIndex = this.groups.findIndex(g => g.items === event.previousContainer.data);
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      // recalc totals for both groups
      if (prevIndex >= 0) this.recalcGroupTotals(prevIndex);
      this.recalcGroupTotals(targetGroupIndex);
    }
  }

  private recalcGroupTotals(groupIndex: number) {
    const g = this.groups[groupIndex];
    if (!g || !g.items) return;
    let assignedSum = 0;
    let paidSum = 0;
    for (const item of g.items) {
      assignedSum += Number(item.assigned ?? 0);
      paidSum += Number(item.paid ?? 0);
      // recalc item available
      item.available = Number(item.assigned ?? 0) + Number(item.paid ?? 0);
    }
    g.assigned = assignedSum;
    g.paid = paidSum;
    g.available = assignedSum + paidSum;
  }

  // helper for template: return ids for all item drop lists
  getItemListIds(): string[] {
    return this.groups.map((_, idx) => `items-${idx}`);
  }

  private animateToggle(el: HTMLElement | undefined, group: any, open: boolean) {
    if (!el) {
      // fallback: just flip state
      group.collapsed = !open ? true : false;
      return;
    }

    group.animating = true;

    const inner = el.querySelector('.collapse-inner') as HTMLElement | null;

    if (open) {
      // opening: start from height 0 -> to scrollHeight
      el.style.height = '0px';
      if (inner) {
        inner.style.transition = 'transform 180ms cubic-bezier(.2,.8,.2,1), opacity 160ms ease';
        inner.style.opacity = '0';
        inner.style.transform = 'translateY(-6px)';
      }
      requestAnimationFrame(() => {
        const target = el.scrollHeight;
        // a slightly snappier height transition
        el.style.transition = 'height 260ms cubic-bezier(.25,.8,.25,1)';
        el.style.height = target + 'px';
        if (inner) {
          inner.style.opacity = '1';
          inner.style.transform = 'translateY(0)';
        }
      });
      const onEnd = (ev?: Event) => {
        el.style.height = '';
        el.style.transition = '';
        el.removeEventListener('transitionend', onEnd);
        group.collapsed = false;
        group.animating = false;
      };
      el.addEventListener('transitionend', onEnd);
    } else {
      // closing: from current height -> 0
      if (inner) {
        inner.style.transition = 'transform 220ms cubic-bezier(.2,.9,.2,1), opacity 200ms ease';
        inner.style.opacity = '0';
        inner.style.transform = 'translateY(-6px)';
      }
      const start = el.scrollHeight;
      el.style.height = start + 'px';
      requestAnimationFrame(() => {
        // slightly quicker closing
        el.style.transition = 'height 220ms cubic-bezier(.25,.8,.25,1)';
        el.style.height = '0px';
      });
      const onEnd = (ev?: Event) => {
        el.style.height = '0px';
        el.style.transition = '';
        el.style.overflow = 'hidden';
        el.removeEventListener('transitionend', onEnd);
        group.collapsed = true;
        group.animating = false;
      };
      el.addEventListener('transitionend', onEnd);
    }
  }

  onAddCategory(index: number, event?: MouseEvent) {
    event?.stopPropagation();
    // append a new empty item for quick testing
    const g = this.groups[index];
    if (!g.items) g.items = [];
    g.items.push({ label: 'Nouvelle catégorie', assigned: 0, paid: 0, available: 0 });
  }

  onItemAssignedChange(groupIndex: number, itemIndex: number, newAssigned: number) {
    const g = this.groups[groupIndex];
    if (!g || !g.items) return;
    const it = g.items[itemIndex];
    it.assigned = newAssigned;
    // recalc available for the item
    const paid = typeof it.paid === 'number' ? it.paid : 0;
    it.available = (typeof newAssigned === 'number' ? newAssigned : 0) + (typeof paid === 'number' ? paid : 0);
    // recalc group totals
    let assignedSum = 0;
    let paidSum = 0;
    for (const item of g.items) {
      assignedSum += Number(item.assigned ?? 0);
      paidSum += Number(item.paid ?? 0);
    }
    g.assigned = assignedSum;
    g.paid = paidSum;
    g.available = assignedSum + paidSum;
  }
}
