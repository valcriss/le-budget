import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Dialog } from '@angular/cdk/dialog';
import { QueryList, ElementRef, EventEmitter } from '@angular/core';

import { BudgetCategories } from './budget-categories';
import { CategoriesStore } from '../../../core/categories/categories.store';
import { BudgetStore } from '../../../core/budget/budget.store';
import { BudgetCategory, BudgetCategoryGroup } from '../../../core/budget/budget.models';
import { Category } from '../../../core/categories/categories.models';

describe('BudgetCategories', () => {
  let component: BudgetCategories;
  let fixture: ComponentFixture<BudgetCategories>;
  let categoriesStoreMock: {
    update: jest.Mock;
    error: jest.Mock;
  };
  let budgetStoreMock: {
    reloadCurrentMonth: jest.Mock;
    monthKey: jest.Mock;
    updateCategoryAssigned: jest.Mock;
    error: jest.Mock;
  };
  let dialogOpenSpy: jest.SpyInstance;

  const makeCategory = (id: string, name: string): Category => ({
    id,
    name,
    kind: 'EXPENSE',
    sortOrder: 0,
    parentCategoryId: null,
    linkedAccountId: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  });

  const makeItem = (id: string, groupId: string, name: string, sortOrder = 0): BudgetCategory => {
    const category = makeCategory(`cat-${id}`, name);
    category.parentCategoryId = groupId;
    category.sortOrder = sortOrder;
    return {
      id: `item-${id}`,
      groupId,
      categoryId: category.id,
      category,
      assigned: 10,
      activity: -5,
      available: 5,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
  };

  const makeGroup = (id: string, items: BudgetCategory[], sortOrder = 0): BudgetCategoryGroup => ({
    id: `group-${id}`,
    monthId: 'month-1',
    categoryId: `group-cat-${id}`,
    category: makeCategory(`group-cat-${id}`, `Group ${id}`),
    assigned: items.reduce((acc, item) => acc + item.assigned, 0),
    activity: items.reduce((acc, item) => acc + item.activity, 0),
    available: items.reduce((acc, item) => acc + item.available, 0),
    items,
  });

  beforeEach(async () => {
    categoriesStoreMock = {
      update: jest.fn(),
      error: jest.fn(() => null),
    };
    budgetStoreMock = {
      reloadCurrentMonth: jest.fn().mockResolvedValue(undefined),
      monthKey: jest.fn(() => '2024-01'),
      updateCategoryAssigned: jest.fn().mockResolvedValue(undefined),
      error: jest.fn(() => null),
    };
    await TestBed.configureTestingModule({
      imports: [BudgetCategories],
      providers: [
        { provide: CategoriesStore, useValue: categoriesStoreMock },
        { provide: BudgetStore, useValue: budgetStoreMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetCategories);
    component = fixture.componentInstance;
    fixture.detectChanges();
    dialogOpenSpy = jest
      .spyOn((component as any).dialog, 'open')
      .mockReturnValue({ close: jest.fn() } as any);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const setGroups = (groups: BudgetCategoryGroup[]) => {
    component.budgetGroups = groups;
  };

  it('maps budget groups and preserves collapsed state', () => {
    const groupSource = [makeGroup('1', [makeItem('1', 'group-cat-1', 'Food')])];
    setGroups(groupSource);
    expect(component.groups).toHaveLength(1);
    expect(component.groups[0]).not.toBe(groupSource[0]);
    component.groups[0].collapsed = true;
    (component as any).syncCollapsedState();
    setGroups([makeGroup('1', [makeItem('2', 'group-cat-1', 'Rent')])]);
    expect(component.groups[0].collapsed).toBe(true);
  });

  it('clones incoming groups and updates cached collapse state', () => {
    const original = makeGroup('3', [makeItem('9', 'group-cat-3', 'Clone')]);
    component['previousCollapsedState'].set(original.categoryId, true);
    component.budgetGroups = [original];
    expect(component.groups[0]).not.toBe(original);
    expect(component.groups[0].items[0]).not.toBe(original.items[0]);
    expect(component.groups[0].collapsed).toBe(true);
    expect(component['previousCollapsedState'].get(original.categoryId)).toBe(true);
  });

  it('handles null inputs and empty item arrays in setter', () => {
    component.budgetGroups = null;
    expect(component.groups).toEqual([]);

    const groupWithEmpty = makeGroup('4', []);
    delete (groupWithEmpty as any).items;
    component.budgetGroups = [groupWithEmpty];
    expect(component.groups[0].items).toEqual([]);
  });

  it('emits selected categories and formats labels', () => {
    const groups = [
      makeGroup('1', [
        { ...makeItem('1', 'group-cat-1', ''), category: null as any, categoryId: '' },
      ]),
    ];
    setGroups(groups);
    const selected: BudgetCategory[] = [];
    component.categorySelected.subscribe((cat) => selected.push(cat));
    component.selectCategory(component.groups[0].items[0]);
    expect(selected).toHaveLength(1);
    expect((component as any).groupLabel({ category: null } as any)).toBe('Sans nom');
    expect((component as any).itemLabel({ category: null } as any)).toBe('Sans nom');
  });

  it('emits selection while stopping event propagation', () => {
    const stop = jest.fn();
    const capture: BudgetCategory[] = [];
    component.categorySelected.subscribe((cat) => capture.push(cat));
    component.selectCategory(makeItem('1', 'group-cat-1', 'A'), { stopPropagation: stop } as any);
    expect(stop).toHaveBeenCalled();
    expect(capture).toHaveLength(1);
  });

  it('toggles group collapsed state without DOM element', () => {
    const groups = [makeGroup('1', [makeItem('1', 'group-cat-1', 'Item')])];
    setGroups(groups);
    expect(component.groups[0].collapsed).toBe(false);
    component.toggleGroup(0);
    expect(component.groups[0].collapsed).toBe(true);
  });

  it('resolves content elements before animating', () => {
    setGroups([makeGroup('1', [])]);
    const el = document.createElement('div');
    const query = new QueryList<ElementRef<HTMLElement>>();
    query.reset([new ElementRef(el)]);
    component['contentEls'] = query;
    const spy = jest.spyOn(component as any, 'animateToggle');
    component.toggleGroup(0);
    expect(spy).toHaveBeenCalledWith(el, component.groups[0], false);
  });

  it('ignores toggleGroup when index out of range', () => {
    const spy = jest.spyOn(component as any, 'animateToggle');
    setGroups([makeGroup('1', [])]);
    component.toggleGroup(5);
    expect(spy).not.toHaveBeenCalled();
  });

  it('reorders groups on drop and schedules persistence', () => {
    const groups = [makeGroup('1', []), makeGroup('2', [])];
    setGroups(groups);
    const scheduleSpy = jest.spyOn(component as any, 'schedulePersistence').mockImplementation(() => {});
    const event = { previousIndex: 0, currentIndex: 1 } as CdkDragDrop<any[]>;
    component.dropGroup(event);
    expect(component.groups[0].categoryId).toBe('group-cat-2');
    expect(scheduleSpy).toHaveBeenCalled();
  });

  it('ignores group drop when order unchanged', () => {
    setGroups([makeGroup('1', []), makeGroup('2', [])]);
    const scheduleSpy = jest.spyOn(component as any, 'schedulePersistence').mockImplementation(() => {});
    component.dropGroup({ previousIndex: 0, currentIndex: 0 } as CdkDragDrop<any[]>);
    expect(scheduleSpy).not.toHaveBeenCalled();
  });

  it('reorders items within the same group', () => {
    const items = [makeItem('1', 'group-cat-1', 'A'), makeItem('2', 'group-cat-1', 'B')];
    const groups = [makeGroup('1', items)];
    setGroups(groups);
    const scheduleSpy = jest.spyOn(component as any, 'schedulePersistence').mockImplementation(() => {});
    const event = {
      previousContainer: { data: component.groups[0].items },
      container: { data: component.groups[0].items },
      previousIndex: 0,
      currentIndex: 1,
    } as unknown as CdkDragDrop<any[]>;
    component.dropItem(event, 0);
    expect(component.groups[0].items[0].id).toBe('item-2');
    expect(scheduleSpy).toHaveBeenCalled();
  });

  it('moves items across groups and recalculates totals', () => {
    const groupA = makeGroup('1', [makeItem('1', 'group-cat-1', 'A')]);
    const groupB = makeGroup('2', [makeItem('2', 'group-cat-2', 'B')]);
    setGroups([groupA, groupB]);
    const scheduleSpy = jest.spyOn(component as any, 'schedulePersistence').mockImplementation(() => {});
    const event = {
      previousContainer: { data: component.groups[0].items },
      container: { data: component.groups[1].items },
      previousIndex: 0,
      currentIndex: 1,
    } as unknown as CdkDragDrop<any[]>;
    component.dropItem(event, 1);
    expect(component.groups[1].items).toHaveLength(2);
    expect(scheduleSpy).toHaveBeenCalled();
  });

  it('ignores item drop when indices unchanged', () => {
    const group = makeGroup('1', [makeItem('1', 'group-cat-1', 'A')]);
    setGroups([group]);
    const scheduleSpy = jest.spyOn(component as any, 'schedulePersistence').mockImplementation(() => {});
    const container = { data: component.groups[0].items };
    const event = {
      previousContainer: container,
      container,
      previousIndex: 0,
      currentIndex: 0,
    } as unknown as CdkDragDrop<any[]>;
    component.dropItem(event, 0);
    expect(scheduleSpy).not.toHaveBeenCalled();
  });

  it('handles cross-group move when previous group has no items', () => {
    const target = makeGroup('2', [makeItem('2', 'group-cat-2', 'B')]);
    setGroups([makeGroup('1', [makeItem('1', 'group-cat-1', 'A')]), target]);
    const scheduleSpy = jest.spyOn(component as any, 'schedulePersistence').mockImplementation(() => {});
    const event = {
      previousContainer: { data: [] },
      container: { data: component.groups[1].items },
      previousIndex: 0,
      currentIndex: 0,
    } as unknown as CdkDragDrop<any[]>;
    component.dropItem(event, 1);
    expect(scheduleSpy).toHaveBeenCalled();
  });

  it('updates assigned amounts and schedules persistence', () => {
    const item = makeItem('1', 'group-cat-1', 'A');
    const group = makeGroup('1', [item]);
    setGroups([group]);
    const scheduleSpy = jest.spyOn(component as any, 'schedulePersistence').mockImplementation(() => {});
    component.onItemAssignedChange(0, 0, 50);
    expect(component.groups[0].items[0].assigned).toBe(50);
    expect(component.groups[0].items[0].available).toBe(45);
    expect(scheduleSpy).toHaveBeenCalled();
  });

  it('opens dialog for add/edit actions when data available', () => {
    const group = makeGroup('1', [makeItem('1', 'group-cat-1', 'A')]);
    setGroups([group]);
    component.openAddCategoryDialog(0);
    expect(dialogOpenSpy).toHaveBeenNthCalledWith(1, expect.any(Function), expect.objectContaining({
      data: expect.objectContaining({ mode: 'create', parentCategoryId: 'group-cat-1' }),
    }));

    component.openEditGroup(component.groups[0]);
    expect(dialogOpenSpy).toHaveBeenNthCalledWith(2, expect.any(Function), expect.objectContaining({
      data: expect.objectContaining({ mode: 'edit', nameLabel: 'Nom du groupe' }),
    }));

    component.openEditCategory(component.groups[0], component.groups[0].items[0]);
    expect(dialogOpenSpy).toHaveBeenNthCalledWith(3, expect.any(Function), expect.objectContaining({
      data: expect.objectContaining({ parentCategoryId: 'group-cat-1' }),
    }));
  });

  it('skips edit dialogs when category data missing', () => {
    setGroups([makeGroup('1', [{ ...makeItem('1', 'group-cat-1', 'A'), category: null as any }])]);
    dialogOpenSpy.mockClear();
    component.openEditGroup({ ...component.groups[0], category: null as any });
    component.openEditCategory(component.groups[0], component.groups[0].items[0]);
    expect(dialogOpenSpy).not.toHaveBeenCalled();
  });

  it('persists group order and reloads on success', async () => {
    const group1 = makeGroup('1', [], 0);
    const group2 = makeGroup('2', [], 0);
    group1.category.sortOrder = 1;
    setGroups([group1, group2]);
    categoriesStoreMock.update.mockResolvedValue({ sortOrder: 0 });

    await (component as any).persistGroupOrder();

    expect(categoriesStoreMock.update).toHaveBeenCalled();
    expect(budgetStoreMock.reloadCurrentMonth).toHaveBeenCalled();
  });

  it('records errors when group order persistence fails', async () => {
    const group1 = makeGroup('1', [], 0);
    group1.category.sortOrder = 1;
    setGroups([group1]);
    categoriesStoreMock.update.mockResolvedValue(null);
    categoriesStoreMock.error.mockReturnValue('Store error');
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();

    await (component as any).persistGroupOrder();

    expect(component.errorMessage).toBe('Store error');
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('skips persisting group order when category missing or unchanged', async () => {
    const group1 = makeGroup('1', [], 0);
    setGroups([group1]);
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();
    categoriesStoreMock.update.mockClear();

    component.groups[0].category = null as any;
    await (component as any).persistGroupOrder();
    expect(categoriesStoreMock.update).not.toHaveBeenCalled();

    categoriesStoreMock.update.mockClear();
    component.groups[0].category = makeCategory('group-cat-1', 'Group');
    component.groups[0].category.sortOrder = 0;
    await (component as any).persistGroupOrder();
    expect(categoriesStoreMock.update).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('persists item order changes across groups', async () => {
    const itemA = makeItem('1', 'group-cat-1', 'A', 0);
    itemA.category.sortOrder = 1;
    const group1 = makeGroup('1', [itemA], 0);
    const group2 = makeGroup('2', [makeItem('2', 'group-cat-2', 'B', 0)]);
    setGroups([group1, group2]);
    categoriesStoreMock.update.mockImplementation(async (_id, payload) => ({
      sortOrder: payload.sortOrder,
      parentCategoryId: payload.parentCategoryId,
    }));

    await (component as any).persistItemOrder([0, 1]);

    expect(categoriesStoreMock.update).toHaveBeenCalled();
    expect(budgetStoreMock.reloadCurrentMonth).toHaveBeenCalled();
  });

  it('handles item order persistence errors', async () => {
    const item = makeItem('1', 'group-cat-1', 'A', 0);
    item.category.sortOrder = 1;
    const group1 = makeGroup('1', [item]);
    setGroups([group1]);
    categoriesStoreMock.update.mockResolvedValue(null);
    categoriesStoreMock.error.mockReturnValue('Order error');
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();

    await (component as any).persistItemOrder([0]);

    expect(component.errorMessage).toBe('Order error');
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('ignores invalid indices and missing categories during item order persistence', async () => {
    const item = makeItem('1', 'group-cat-1', 'A', 0);
    setGroups([makeGroup('1', [item])]);
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();
    categoriesStoreMock.update.mockClear();

    await (component as any).persistItemOrder([-1, 5]);
    expect(categoriesStoreMock.update).not.toHaveBeenCalled();

    component.groups[0].items[0].category = null as any;
    await (component as any).persistItemOrder([0]);
    expect(categoriesStoreMock.update).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('returns early when persistItemOrder detects no changes', async () => {
    const item = makeItem('1', 'group-cat-1', 'A', 0);
    item.category.sortOrder = 0;
    item.category.parentCategoryId = 'group-cat-1';
    setGroups([makeGroup('1', [item])]);
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();

    await (component as any).persistItemOrder([0]);

    expect(categoriesStoreMock.update).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('persists assigned changes and handles errors', async () => {
    const item = makeItem('1', 'group-cat-1', 'A');
    const group = makeGroup('1', [item]);
    setGroups([group]);

    await (component as any).persistAssignedChange(0, 0);
    expect(budgetStoreMock.updateCategoryAssigned).toHaveBeenCalledWith('2024-01', item.categoryId, item.assigned);

    budgetStoreMock.updateCategoryAssigned.mockRejectedValue(new Error('fail'));
    budgetStoreMock.error.mockReturnValue('Assigned error');
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await (component as any).persistAssignedChange(0, 0);
    expect(component.errorMessage).toBe('Assigned error');
    expect(reloadSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('reloads budget silently and swallows errors', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    budgetStoreMock.reloadCurrentMonth.mockRejectedValue(new Error('fail'));
    await (component as any).reloadBudgetSilently();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('queues persistence tasks and logs rejections', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await (component as any).schedulePersistence(() => Promise.resolve());
    await (component as any).schedulePersistence(() => Promise.reject(new Error('queue fail')));
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('recalculates group totals and item availability', () => {
    const items = [
      { ...makeItem('1', 'group-cat-1', 'A'), assigned: 10, activity: -5 },
      { ...makeItem('2', 'group-cat-1', 'B'), assigned: 20, activity: 5 },
    ];
    setGroups([makeGroup('1', items)]);
    (component as any).recalcGroupTotals(0);
    const group = component.groups[0];
    expect(group.assigned).toBe(30);
    expect(group.activity).toBe(0);
    expect(group.available).toBe(30);
    expect(group.items[0].available).toBe(5);
  });

  it('returns the list of item drop ids', () => {
    setGroups([makeGroup('1', []), makeGroup('2', [])]);
    expect((component as any).getItemListIds()).toEqual(['items-0', 'items-1']);
  });

  it('updates drop indicator while dragging groups', () => {
    const groupEl = document.createElement('div');
    groupEl.className = 'group-drag';
    Object.assign(groupEl, {
      getBoundingClientRect: () => ({ top: 0, bottom: 40, left: 0, width: 100, height: 40 }) as DOMRect,
    });
    document.body.appendChild(groupEl);

    component['previewIsGroup'] = true;
    component.onDragMoved({ pointerPosition: { x: 10, y: 10 } } as any);
    expect(component.showDropIndicator).toBe(true);

    document.body.removeChild(groupEl);
  });

  it('updates drop indicator while dragging items', () => {
    setGroups([makeGroup('1', [makeItem('1', 'group-cat-1', 'A')])]);
    component['previewIsGroup'] = false;
    const list = document.createElement('div');
    list.id = 'items-0';
    const row = document.createElement('div');
    row.className = 'item-drag';
    list.appendChild(row);
    document.body.appendChild(list);

    Object.assign(list, {
      getBoundingClientRect: () => ({ top: 0, bottom: 40, left: 0, width: 100, height: 40 }) as DOMRect,
    });
    Object.assign(row, {
      getBoundingClientRect: () => ({ top: 0, bottom: 40, left: 0, width: 100, height: 40 }) as DOMRect,
    });
    const originalElementFromPoint = document.elementFromPoint;
    (document as any).elementFromPoint = jest.fn(() => row);

    component.onDragMoved({ pointerPosition: { x: 5, y: 5 } } as any);
    expect(component.showDropIndicator).toBe(true);

    document.body.removeChild(list);
    (document as any).elementFromPoint = originalElementFromPoint;
  });

  it('ignores drag move when pointer data missing', () => {
    component.showDropIndicator = true;
    component.onDragMoved({} as any);
    expect(component.showDropIndicator).toBe(true);
  });

  it('clears indicator when no groups are present', () => {
    component['previewIsGroup'] = true;
    component.showDropIndicator = true;
    const originalQuery = document.querySelectorAll;
    (document as any).querySelectorAll = jest.fn(() => []);
    component.onDragMoved({ pointerPosition: { x: 0, y: 0 } } as any);
    expect(component.showDropIndicator).toBe(false);
    (document as any).querySelectorAll = originalQuery;
  });

  it('handles empty item containers when dragging items', () => {
    const list = document.createElement('div');
    list.id = 'items-0';
    Object.assign(list, {
      getBoundingClientRect: () => ({ top: 10, left: 5, width: 80, height: 30 } as DOMRect),
      closest: () => list,
      querySelectorAll: () => [],
    });
    document.body.appendChild(list);
    component['previewIsGroup'] = false;
    const originalElementFromPoint = document.elementFromPoint;
    (document as any).elementFromPoint = jest.fn(() => list);
    component.onDragMoved({ pointerPosition: { x: 10, y: 15 } } as any);
    expect(component.dropIndicatorWidth).toBe(80);
    document.body.removeChild(list);
    (document as any).elementFromPoint = originalElementFromPoint;
  });

  it('falls back when elementFromPoint returns null', () => {
    const original = document.elementFromPoint;
    (document as any).elementFromPoint = jest.fn(() => null);
    component.showDropIndicator = true;
    component.onDragMoved({ pointerPosition: { x: 1, y: 1 } } as any);
    expect(component.showDropIndicator).toBe(false);
    (document as any).elementFromPoint = original;
  });

  it('provides label and formatting helpers', () => {
    const group = makeGroup('1', [makeItem('1', 'group-cat-1', 'A')]);
    expect((component as any).groupLabel(group)).toBe('Group 1');
    expect((component as any).groupLabel({ category: null } as any)).toBe('Sans nom');
    expect((component as any).itemLabel(group.items[0])).toBe('A');
    expect((component as any).itemLabel({ category: null } as any)).toBe('Sans nom');
    expect((component as any).formatCurrencyWithSign(42)).toContain('42');
    expect((component as any).getAmountClass(10)).toBe('text-emerald-600');
  });

  it('tracks group drag start width and sets preview flags', () => {
    setGroups([makeGroup('1', [])]);
    const header = document.createElement('div');
    header.id = 'group-header-0';
    header.className = 'group-drag';
    Object.assign(header, {
      getBoundingClientRect: () => ({ width: 120, height: 40, top: 0, left: 0, bottom: 40, right: 120 }) as DOMRect,
      closest: () => header,
    });
    document.body.appendChild(header);

    component.onGroupDragStarted(0, {} as any);

    expect(component['previewIsGroup']).toBe(true);
    expect(component['previewGroupIndex']).toBe(0);
    expect(component['previewWidthPx']).toBe(120);

    document.body.removeChild(header);
  });

  it('tracks item drag start width', () => {
    setGroups([makeGroup('1', [makeItem('1', 'group-cat-1', 'A')])]);
    const row = document.createElement('div');
    row.id = 'item-row-0-0';
    row.className = 'item-drag';
    Object.assign(row, {
      getBoundingClientRect: () => ({ width: 80, height: 30, top: 0, left: 0, bottom: 30, right: 80 }) as DOMRect,
      closest: () => row,
    });
    document.body.appendChild(row);

    component.onItemDragStarted(0, 0, {} as any);

    expect(component['previewIsGroup']).toBe(false);
    expect(component['previewItemIndex']).toBe(0);
    expect(component['previewWidthPx']).toBe(80);

    document.body.removeChild(row);
  });

  it('resets preview state on drag end', () => {
    component['previewIsGroup'] = true;
    component['previewGroupIndex'] = 1;
    component['previewItemIndex'] = 2;
    component.showDropIndicator = true;

    component.onDragEnded();

    expect(component['previewGroupIndex']).toBeUndefined();
    expect(component['previewItemIndex']).toBeUndefined();
    expect(component.showDropIndicator).toBe(false);
  });

  it('falls back when animateToggle receives no element', () => {
    const group = makeGroup('1', []);
    component['previousCollapsedState'].set(group.categoryId, false);
    (component as any).animateToggle(undefined, group, true);
    expect(component['previousCollapsedState'].get(group.categoryId)).toBe(false);
  });

  describe('animateToggle transitions', () => {
    const originalRaf = globalThis.requestAnimationFrame;

    beforeEach(() => {
      (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => cb(0);
    });

    afterEach(() => {
      (globalThis as any).requestAnimationFrame = originalRaf;
    });

    it('opens a collapsed group with animation', () => {
      const group = makeGroup('1', []);
      group.collapsed = true;
      const el = document.createElement('div');
      const inner = document.createElement('div');
      inner.className = 'collapse-inner';
      el.appendChild(inner);
      Object.defineProperty(el, 'scrollHeight', { value: 100 });
      const listeners: Record<string, EventListener> = {};
      el.addEventListener = jest.fn((event: string, handler: EventListener) => {
        listeners[event] = handler;
      });
      el.removeEventListener = jest.fn();

      (component as any).animateToggle(el, group, true);

      expect(el.style.height).toBe('100px');
      listeners['transitionend']?.(new Event('transitionend'));
      expect(group.collapsed).toBe(false);
      expect(component['previousCollapsedState'].get(group.categoryId)).toBe(false);
    });

    it('closes an open group with animation', () => {
      const group = makeGroup('1', []);
      group.collapsed = false;
      const el = document.createElement('div');
      const inner = document.createElement('div');
      inner.className = 'collapse-inner';
      el.appendChild(inner);
      Object.defineProperty(el, 'scrollHeight', { value: 80 });
      const listeners: Record<string, EventListener> = {};
      el.addEventListener = jest.fn((event: string, handler: EventListener) => {
        listeners[event] = handler;
      });
      el.removeEventListener = jest.fn();

      (component as any).animateToggle(el, group, false);

      expect(el.style.height).toBe('0px');
      listeners['transitionend']?.(new Event('transitionend'));
      expect(group.collapsed).toBe(true);
      expect(component['previousCollapsedState'].get(group.categoryId)).toBe(true);
    });
  });
});
