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
      requiredAmount: 0,
      optimizedAmount: 0,
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
    const scheduleSpy = jest
      .spyOn(component as any, 'schedulePersistence')
      .mockImplementation((task: () => Promise<void>) => {
        void task();
      });
    jest.spyOn(component as any, 'persistGroupOrder').mockResolvedValue();
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

  it('reorders items using the same container reference and recalculates totals', () => {
    const items = [
      { ...makeItem('1', 'group-cat-1', 'A'), assigned: 10, activity: -2 },
      { ...makeItem('2', 'group-cat-1', 'B'), assigned: 5, activity: 1 },
    ];
    setGroups([makeGroup('1', items)]);
    const container = { data: component.groups[0].items };
    const event = {
      previousContainer: container,
      container,
      previousIndex: 0,
      currentIndex: 1,
    } as unknown as CdkDragDrop<any[]>;

    component.dropItem(event, 0);

    expect(component.groups[0].items[0].id).toBe('item-2');
    expect(component.groups[0].assigned).toBe(15);
  });

  it('moves items across groups and recalculates totals', () => {
    const groupA = makeGroup('1', [makeItem('1', 'group-cat-1', 'A')]);
    const groupB = makeGroup('2', [makeItem('2', 'group-cat-2', 'B')]);
    setGroups([groupA, groupB]);
    const scheduleSpy = jest
      .spyOn(component as any, 'schedulePersistence')
      .mockImplementation((task: () => Promise<void>) => {
        void task();
      });
    jest.spyOn(component as any, 'persistItemOrder').mockResolvedValue();
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

  it('handles assigned changes when activity is not numeric', () => {
    const item = makeItem('1', 'group-cat-1', 'A');
    item.activity = null as any;
    const group = makeGroup('1', [item]);
    setGroups([group]);
    const scheduleSpy = jest.spyOn(component as any, 'schedulePersistence').mockImplementation(() => {});

    component.onItemAssignedChange(0, 0, 20);

    expect(component.groups[0].items[0].available).toBe(20);
    expect(scheduleSpy).toHaveBeenCalled();
  });

  it('recalculates group totals based on item values', () => {
    const item = makeItem('1', 'group-cat-1', 'A');
    item.assigned = '7' as any;
    item.activity = '3' as any;
    const group = makeGroup('1', [item]);
    setGroups([group]);

    (component as any).recalcGroupTotals(0);

    expect(component.groups[0].assigned).toBe(7);
    expect(component.groups[0].activity).toBe(3);
    expect(component.groups[0].available).toBe(10);
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

  it('skips add dialog when group is missing', () => {
    setGroups([]);
    dialogOpenSpy.mockClear();
    component.openAddCategoryDialog(0);
    expect(dialogOpenSpy).not.toHaveBeenCalled();
  });

  it('uses fallback placeholders when category names are missing', () => {
    const group = makeGroup('1', [makeItem('1', 'group-cat-1', 'A')]);
    group.category.name = null as any;
    group.items[0].category!.name = null as any;
    setGroups([group]);

    component.openEditGroup(component.groups[0]);
    component.openEditCategory(component.groups[0], component.groups[0].items[0]);

    expect(dialogOpenSpy).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      data: expect.objectContaining({ placeholder: 'Nom du groupe' }),
    }));
    expect(dialogOpenSpy).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      data: expect.objectContaining({ placeholder: 'Nom de la catégorie' }),
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

  it('skips group order persistence when sort order already matches', async () => {
    const group = makeGroup('1', [], 0);
    group.category.sortOrder = 0;
    setGroups([group]);
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();

    await (component as any).persistGroupOrder();

    expect(categoriesStoreMock.update).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('persists group order and keeps desired sort order when server omits it', async () => {
    const group = makeGroup('1', [], 1);
    group.category.sortOrder = 1;
    setGroups([group]);
    categoriesStoreMock.update.mockResolvedValue({ ...group.category, sortOrder: undefined });
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();

    await (component as any).persistGroupOrder();

    expect(group.category.sortOrder).toBe(0);
    expect(reloadSpy).toHaveBeenCalled();
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

  it('handles exceptions while persisting group order', async () => {
    const group1 = makeGroup('1', [], 0);
    group1.category.sortOrder = 1;
    setGroups([group1]);
    categoriesStoreMock.update.mockRejectedValue(new Error('boom'));
    categoriesStoreMock.error.mockReturnValue(null);
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();

    await (component as any).persistGroupOrder();

    expect(component.errorMessage).toContain("Impossible");
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

  it('updates parent category when items move to new group', async () => {
    const itemA = makeItem('1', 'group-cat-1', 'A', 0);
    itemA.category.sortOrder = 1;
    itemA.category.parentCategoryId = 'other-parent';
    const group1 = makeGroup('1', [itemA], 0);
    setGroups([group1]);
    categoriesStoreMock.update.mockImplementation(async (_id, payload) => ({
      sortOrder: payload.sortOrder,
      parentCategoryId: payload.parentCategoryId,
    }));

    await (component as any).persistItemOrder([0]);

    expect(categoriesStoreMock.update).toHaveBeenCalledWith(itemA.category.id, {
      parentCategoryId: 'group-cat-1',
      sortOrder: 0,
    });
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

  it('handles exceptions while persisting item order', async () => {
    const item = makeItem('1', 'group-cat-1', 'A', 0);
    item.category.sortOrder = 1;
    const group1 = makeGroup('1', [item]);
    setGroups([group1]);
    categoriesStoreMock.update.mockRejectedValue(new Error('boom'));
    categoriesStoreMock.error.mockReturnValue(null);
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();

    await (component as any).persistItemOrder([0]);

    expect(component.errorMessage).toContain('Impossible');
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

  it('skips missing groups while persisting item order', async () => {
    component.groups = [undefined as any];
    await (component as any).persistItemOrder([0]);
    expect(categoriesStoreMock.update).not.toHaveBeenCalled();
  });

  it('updates category sort order and parent when persisting item order', async () => {
    const item = makeItem('1', 'group-cat-1', 'A', 5);
    const group = makeGroup('1', [item]);
    group.categoryId = 'new-parent';
    setGroups([group]);
    categoriesStoreMock.update.mockResolvedValue({
      ...item.category,
      sortOrder: undefined,
      parentCategoryId: undefined,
    });
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();

    await (component as any).persistItemOrder([0]);

    expect(categoriesStoreMock.update).toHaveBeenCalled();
    expect(item.category!.sortOrder).toBe(0);
    expect(item.category!.parentCategoryId).toBe('new-parent');
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('persists assigned value when assigned is a string', async () => {
    const item = makeItem('1', 'group-cat-1', 'A');
    item.assigned = '42' as any;
    setGroups([makeGroup('1', [item])]);

    await (component as any).persistAssignedChange(0, 0);

    expect(budgetStoreMock.updateCategoryAssigned).toHaveBeenCalledWith('2024-01', item.categoryId, 42);
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

  it('uses fallback error when assigned update fails without store error', async () => {
    const item = makeItem('1', 'group-cat-1', 'A');
    setGroups([makeGroup('1', [item])]);
    budgetStoreMock.updateCategoryAssigned.mockRejectedValue(new Error('fail'));
    budgetStoreMock.error.mockReturnValue(null);
    const reloadSpy = jest.spyOn(component as any, 'reloadBudgetSilently').mockResolvedValue();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await (component as any).persistAssignedChange(0, 0);

    expect(component.errorMessage).toBe('Impossible de mettre à jour le montant assigné.');
    expect(reloadSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('skips persisting assigned changes when data is missing', async () => {
    setGroups([]);
    await (component as any).persistAssignedChange(0, 0);
    expect(budgetStoreMock.updateCategoryAssigned).not.toHaveBeenCalled();

    setGroups([makeGroup('1', [makeItem('1', 'group-cat-1', 'A')])]);
    component.groups[0].items[0].categoryId = '';
    await (component as any).persistAssignedChange(0, 0);
    expect(budgetStoreMock.updateCategoryAssigned).not.toHaveBeenCalled();

    budgetStoreMock.monthKey = jest.fn(() => null);
    component.groups[0].items[0].categoryId = 'cat-1';
    await (component as any).persistAssignedChange(0, 0);
    expect(budgetStoreMock.updateCategoryAssigned).not.toHaveBeenCalled();
    budgetStoreMock.monthKey = jest.fn(() => '2024-01');
  });

  it('skips persisting assigned changes when month key is missing', async () => {
    setGroups([makeGroup('1', [makeItem('1', 'group-cat-1', 'A')])]);
    component.groups[0].items[0].categoryId = 'cat-1';
    budgetStoreMock.monthKey = jest.fn(() => null);

    await (component as any).persistAssignedChange(0, 0);

    expect(budgetStoreMock.updateCategoryAssigned).not.toHaveBeenCalled();
    budgetStoreMock.monthKey = jest.fn(() => '2024-01');
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

  it('chooses the nearest group when pointer is between groups', () => {
    const g1 = document.createElement('div');
    g1.className = 'group-drag';
    Object.assign(g1, {
      getBoundingClientRect: () => ({ top: 0, bottom: 10, left: 0, width: 100, height: 10 }) as DOMRect,
    });
    const g2 = document.createElement('div');
    g2.className = 'group-drag';
    Object.assign(g2, {
      getBoundingClientRect: () => ({ top: 40, bottom: 50, left: 0, width: 120, height: 10 }) as DOMRect,
    });
    document.body.appendChild(g1);
    document.body.appendChild(g2);

    component['previewIsGroup'] = true;
    component.onDragMoved({ pointerPosition: { x: 5, y: 25 } } as any);

    expect(component.showDropIndicator).toBe(true);

    document.body.removeChild(g1);
    document.body.removeChild(g2);
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

  it('skips drag preview elements when resolving item targets', () => {
    setGroups([makeGroup('1', [makeItem('1', 'group-cat-1', 'A')])]);
    component['previewIsGroup'] = false;
    const preview = document.createElement('div');
    preview.className = 'cdk-drag-preview';
    const target = document.createElement('div');
    target.className = 'item-drag';
    (target as any).closest = jest.fn(() => target);
    Object.assign(target, {
      getBoundingClientRect: () => ({ top: 0, bottom: 20, left: 0, width: 60, height: 20 }) as DOMRect,
    });
    const originalElementFromPoint = document.elementFromPoint;
    (document as any).elementFromPoint = jest
      .fn()
      .mockReturnValueOnce(preview)
      .mockReturnValueOnce(target);

    component.onDragMoved({ pointerPosition: { x: 5, y: 5 } } as any);

    expect(component.showDropIndicator).toBe(true);

    (document as any).elementFromPoint = originalElementFromPoint;
  });

  it('picks nearest row when pointer is outside item rows', () => {
    setGroups([makeGroup('1', [makeItem('1', 'group-cat-1', 'A')])]);
    component['previewIsGroup'] = false;
    const list = document.createElement('div');
    list.id = 'items-0';
    const row1 = document.createElement('div');
    row1.className = 'item-drag';
    const row2 = document.createElement('div');
    row2.className = 'item-drag';
    list.appendChild(row1);
    list.appendChild(row2);
    document.body.appendChild(list);

    Object.assign(row1, {
      getBoundingClientRect: () => ({ top: 0, bottom: 10, left: 0, width: 50, height: 10 }) as DOMRect,
      closest: (selector: string) => (selector.startsWith('[id^="items-"]') ? list : row1),
    });
    Object.assign(row2, {
      getBoundingClientRect: () => ({ top: 30, bottom: 40, left: 0, width: 70, height: 10 }) as DOMRect,
      closest: (selector: string) => (selector.startsWith('[id^="items-"]') ? list : row2),
    });

    const originalElementFromPoint = document.elementFromPoint;
    (document as any).elementFromPoint = jest.fn(() => row1);

    component.onDragMoved({ pointerPosition: { x: 5, y: 20 } } as any);

    expect(component.showDropIndicator).toBe(true);

    document.body.removeChild(list);
    (document as any).elementFromPoint = originalElementFromPoint;
  });

  it('falls back to highlighting the target element when no list is found', () => {
    component['previewIsGroup'] = false;
    const target = document.createElement('div');
    target.className = 'group-drag';
    (target as any).closest = jest.fn((selector: string) =>
      selector === '[id^="items-"]' ? null : target,
    );
    Object.assign(target, {
      getBoundingClientRect: () => ({ top: 5, bottom: 15, left: 2, width: 90, height: 10 }) as DOMRect,
    });
    const originalElementFromPoint = document.elementFromPoint;
    (document as any).elementFromPoint = jest.fn(() => target);

    component.onDragMoved({ pointerPosition: { x: 4, y: 6 } } as any);

    expect(component.showDropIndicator).toBe(true);

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

  it('clears indicator when drag move throws', () => {
    const original = document.elementFromPoint;
    (document as any).elementFromPoint = jest.fn(() => {
      throw new Error('boom');
    });
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

  it('clears preview width when group drag measurement fails', () => {
    setGroups([makeGroup('1', [])]);
    const spy = jest.spyOn(document, 'getElementById').mockImplementation(() => {
      throw new Error('boom');
    });

    component.previewWidthPx = 99;
    component.onGroupDragStarted(0, {} as any);

    expect(component['previewWidthPx']).toBe(0);
    spy.mockRestore();
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

  it('clears preview width when item drag measurement fails', () => {
    setGroups([makeGroup('1', [makeItem('1', 'group-cat-1', 'A')])]);
    const spy = jest.spyOn(document, 'getElementById').mockImplementation(() => {
      throw new Error('boom');
    });

    component.previewWidthPx = 88;
    component.onItemDragStarted(0, 0, {} as any);

    expect(component['previewWidthPx']).toBe(0);
    spy.mockRestore();
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
