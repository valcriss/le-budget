import { Component, ElementRef, Input, ViewChildren, QueryList, inject } from '@angular/core';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem, CdkDragStart, CdkDragEnd, CdkDragMove } from '@angular/cdk/drag-drop';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CommonModule } from '@angular/common';
import { faChevronRight, faPlusSquare } from '@fortawesome/free-solid-svg-icons';
import { formatCurrencyWithSign, getAmountClass } from '../../../shared/formatters';
import { InputAmount } from '../../ui/input-amount/input-amount';
import { BadgeAmount } from '../../ui/badge-amount/badge-amount';
import { BudgetCategory, BudgetCategoryGroup } from '../../../core/budget/budget.models';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { CategoryCreateDialog } from '../category-create-dialog/category-create-dialog';
// (CDK drag types are imported above)

@Component({
  selector: 'app-budget-categories',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, InputAmount, BadgeAmount, DragDropModule, DialogModule],
  templateUrl: './budget-categories.html',
  styleUrls: ['./budget-categories.css'],
})
export class BudgetCategories {
  protected readonly icChevronRight = faChevronRight;
  protected readonly icAdd = faPlusSquare;
  private readonly dialog = inject(Dialog);

  constructor(library: FaIconLibrary) {
  library.addIcons(faChevronRight, faPlusSquare);
  }

  private previousCollapsedState = new Map<string, boolean>();

  // groups supplied by parent; we augment each group with UI state below
  groups: Array<BudgetCategoryGroup & { collapsed?: boolean; animating?: boolean }> = [];

  @Input()
  set budgetGroups(value: BudgetCategoryGroup[] | null) {
    const incoming = value ?? [];
    const collapsedById = new Map(this.previousCollapsedState);
    const mapped = incoming.map((group) => {
      const collapsed = collapsedById.get(group.categoryId) ?? false;
      return {
        ...group,
        collapsed,
        animating: false,
        items: (group.items ?? []).map((item) => ({ ...item })),
      };
    });
    this.groups = mapped;
    this.syncCollapsedState();
  }

  protected groupLabel(group: BudgetCategoryGroup): string {
    return group.category?.name ?? 'Sans nom';
  }

  protected itemLabel(item: BudgetCategory): string {
    return item.category?.name ?? 'Sans nom';
  }

  // preview sizing/state used for ghost previews
  previewWidthPx = 0;
  previewIsGroup = false;
  // reference to the group/item being previewed
  previewGroupIndex?: number;
  previewItemIndex?: number;

  // drop indicator (visual destination under cursor)
  showDropIndicator = false;
  dropIndicatorTop = 0;
  dropIndicatorLeft = 0;
  dropIndicatorWidth = 0;
  dropIndicatorHeight = 0;
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
    // clear visual indicator immediately (covers no-op drops as well)
    this.showDropIndicator = false;
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.groups, event.previousIndex, event.currentIndex);
    this.syncCollapsedState();
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
    // clear visual indicator after completing the drop
    this.showDropIndicator = false;
  }

  // handle drag start to capture size & state for better preview matching
  onGroupDragStarted(groupIndex: number, e: CdkDragStart) {
    this.previewIsGroup = true;
    this.previewGroupIndex = groupIndex;
    this.previewItemIndex = undefined;
    // try to measure the group's header width from DOM
    try {
      const headerEl = document.getElementById('group-header-' + groupIndex);
      let elToMeasure: HTMLElement | null = headerEl;
      // prefer the closest cdkDrag root (the .group-drag) if present, it better represents the full width
      if (headerEl && (headerEl as HTMLElement).closest) {
        const root = (headerEl as HTMLElement).closest('.group-drag') as HTMLElement | null;
        if (root) elToMeasure = root;
      }
      if (elToMeasure) {
        const rect = elToMeasure.getBoundingClientRect();
        this.previewWidthPx = Math.round(rect.width || (elToMeasure as any).offsetWidth || 0);
      }
    } catch (err) {
      this.previewWidthPx = 0;
    }
  }

  onItemDragStarted(groupIndex: number, itemIndex: number, e: CdkDragStart) {
    this.previewIsGroup = false;
    this.previewGroupIndex = groupIndex;
    this.previewItemIndex = itemIndex;
    try {
      const rowEl = document.getElementById(`item-row-${groupIndex}-${itemIndex}`);
      let elToMeasure: HTMLElement | null = rowEl;
      if (rowEl && (rowEl as HTMLElement).closest) {
        // prefer the closest .item-drag (the draggable wrapper) if present
        const root = (rowEl as HTMLElement).closest('.item-drag') as HTMLElement | null;
        if (root) elToMeasure = root;
      }
      if (elToMeasure) {
        const rect = elToMeasure.getBoundingClientRect();
        this.previewWidthPx = Math.round(rect.width || (elToMeasure as any).offsetWidth || 0);
      }
    } catch (err) {
      this.previewWidthPx = 0;
    }
  }

  onDragEnded(e?: CdkDragEnd) {
    this.previewWidthPx = 0;
    this.previewGroupIndex = undefined;
    this.previewItemIndex = undefined;
    // hide floating drop indicator
    this.showDropIndicator = false;
  }

  private syncCollapsedState() {
    this.previousCollapsedState = new Map(
      this.groups.map((group) => [group.categoryId, !!group.collapsed]),
    );
  }

  onDragMoved(e: CdkDragMove) {
    // pointerPosition is in viewport coordinates
    try {
      const p = e.pointerPosition;
      if (!p) return;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      // If we're dragging a whole group, try to highlight the group under the pointer
      if (this.previewIsGroup) {
        const groups = Array.from(document.querySelectorAll('.group-drag')) as HTMLElement[];
        if (!groups || groups.length === 0) {
          this.showDropIndicator = false;
          return;
        }
        // find a group whose rect contains the pointer Y
        let chosen: HTMLElement | null = null;
        for (const gEl of groups) {
          const r = gEl.getBoundingClientRect();
          if (y >= r.top && y <= r.bottom) { chosen = gEl; break; }
        }
        if (!chosen) {
          // pick the closest by vertical distance
          let best: {el: HTMLElement; dist: number} | null = null;
          for (const gEl of groups) {
            const r = gEl.getBoundingClientRect();
            const dist = Math.min(Math.abs(y - r.top), Math.abs(y - r.bottom));
            if (!best || dist < best.dist) best = { el: gEl, dist };
          }
          chosen = best ? best.el : null;
        }
        if (!chosen) { this.showDropIndicator = false; return; }
        const rect = chosen.getBoundingClientRect();
        this.dropIndicatorTop = Math.round(rect.top);
        this.dropIndicatorLeft = Math.round(rect.left);
        this.dropIndicatorWidth = Math.round(rect.width);
        this.dropIndicatorHeight = Math.round(rect.height);
        this.showDropIndicator = true;
        return;
      }

      // For non-group drags (items), use elementFromPoint but ignore drag previews
      let el = document.elementFromPoint(x, y) as HTMLElement | null;
      // skip if the element is a drag preview or inside one
      let attempts = 0;
      while (el && attempts < 6) {
        if (el.classList && (el.classList.contains('cdk-drag-preview') || el.classList.contains('drag-preview'))) {
          // temporarily get the element just underneath by nudging y by +1px
          el = document.elementFromPoint(x, y + 1) as HTMLElement | null;
          attempts++;
          continue;
        }
        break;
      }
      if (!el) { this.showDropIndicator = false; return; }
      const target = el.closest('[id^="items-"], .item-drag, .group-drag') as HTMLElement | null;
  if (!target) { this.showDropIndicator = false; return; }

      // For items, compute an insertion line between rows in the target list when possible
      const itemsList = target.closest('[id^="items-"]') as HTMLElement | null;
      if (itemsList) {
        const rows = Array.from(itemsList.querySelectorAll('.item-drag')) as HTMLElement[];
        if (rows.length === 0) {
          const r = itemsList.getBoundingClientRect();
          this.dropIndicatorTop = Math.round(r.top);
          this.dropIndicatorLeft = Math.round(r.left);
          this.dropIndicatorWidth = Math.round(r.width);
          this.dropIndicatorHeight = Math.round(r.height);
          this.showDropIndicator = true;
          return;
        }
        // find row under pointer
        let rowIndex = -1;
        for (let k = 0; k < rows.length; k++) {
          const rr = rows[k].getBoundingClientRect();
          if (y >= rr.top && y <= rr.bottom) { rowIndex = k; break; }
        }
        if (rowIndex === -1) {
          // choose nearest row
          let best = { idx: -1, dist: Infinity };
          for (let k = 0; k < rows.length; k++) {
            const rr = rows[k].getBoundingClientRect();
            const dist = Math.min(Math.abs(y - rr.top), Math.abs(y - rr.bottom));
            if (dist < best.dist) best = { idx: k, dist };
          }
          rowIndex = best.idx;
        }
        if (rowIndex < 0) { this.showDropIndicator = false; return; }
        const rowRect = rows[rowIndex].getBoundingClientRect();
        this.dropIndicatorTop = Math.round(rowRect.top);
        this.dropIndicatorLeft = Math.round(rowRect.left);
        this.dropIndicatorWidth = Math.round(rowRect.width);
        this.dropIndicatorHeight = Math.round(rowRect.height);
        this.showDropIndicator = true;
        return;
      }

      // fallback to highlighting the target element
      const rect = target.getBoundingClientRect();
      this.dropIndicatorTop = Math.round(rect.top);
      this.dropIndicatorLeft = Math.round(rect.left);
      this.dropIndicatorWidth = Math.round(rect.width);
      this.dropIndicatorHeight = Math.round(rect.height);
      this.showDropIndicator = true;
    } catch (err) {
      this.showDropIndicator = false;
    }
  }

  private recalcGroupTotals(groupIndex: number) {
    const g = this.groups[groupIndex];
    if (!g || !g.items) return;
    let assignedSum = 0;
    let activitySum = 0;
    for (const item of g.items) {
      assignedSum += Number(item.assigned ?? 0);
      activitySum += Number(item.activity ?? 0);
      // recalc item available
      item.available = Number(item.assigned ?? 0) + Number(item.activity ?? 0);
    }
    g.assigned = assignedSum;
    g.activity = activitySum;
    g.available = assignedSum + activitySum;
  }

  // helper for template: return ids for all item drop lists
  getItemListIds(): string[] {
    return this.groups.map((_, idx) => `items-${idx}`);
  }

  private animateToggle(el: HTMLElement | undefined, group: any, open: boolean) {
    if (!el) {
      // fallback: just flip state
      group.collapsed = !open ? true : false;
      this.previousCollapsedState.set(group.categoryId, !!group.collapsed);
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
        this.previousCollapsedState.set(group.categoryId, false);
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
        this.previousCollapsedState.set(group.categoryId, true);
      };
      el.addEventListener('transitionend', onEnd);
    }
  }

  openAddCategoryDialog(index: number, event?: MouseEvent) {
    event?.stopPropagation();
    const group = this.groups[index];
    if (!group) return;
    this.dialog.open(CategoryCreateDialog, {
      data: {
        parentCategoryId: group.categoryId,
        title: 'Créer une catégorie',
        nameLabel: 'Nom de la catégorie',
        placeholder: 'Ex : Supermarché',
      },
    });
  }

  onItemAssignedChange(groupIndex: number, itemIndex: number, newAssigned: number) {
    const g = this.groups[groupIndex];
    if (!g || !g.items) return;
    const it = g.items[itemIndex];
    it.assigned = newAssigned;
    // recalc available for the item
    const activity = typeof it.activity === 'number' ? it.activity : 0;
    it.available =
      (typeof newAssigned === 'number' ? newAssigned : 0) + (typeof activity === 'number' ? activity : 0);
    // recalc group totals
    this.recalcGroupTotals(groupIndex);
  }
}
