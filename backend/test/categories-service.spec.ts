import { strict as assert } from 'assert';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoryKind } from '@prisma/client';
import { CategoriesService } from '../src/modules/categories/categories.service';

type CategoryRecord = {
  id: string;
  userId: string;
  name: string;
  kind: CategoryKind;
  sortOrder: number;
  parentCategoryId: string | null;
};

class CategoriesPrismaStub {
  public categories: CategoryRecord[] = [];

  constructor(initial: CategoryRecord[] = []) {
    this.categories = initial.map((item) => ({ ...item }));
  }

  category = {
    create: async ({ data }: { data: any }) => {
      const record: CategoryRecord = {
        id: `cat-${this.categories.length + 1}`,
        userId: data.userId,
        name: data.name,
        kind: data.kind,
        sortOrder: data.sortOrder,
        parentCategoryId: data.parentCategoryId ?? null,
      };
      this.categories.push(record);
      return { ...record };
    },

    findMany: async ({ where, orderBy }: { where: { userId: string }; orderBy?: Array<{ sortOrder?: 'asc' | 'desc'; name?: 'asc' | 'desc' }> }) => {
      let items = this.categories.filter((cat) => cat.userId === where.userId);
      if (orderBy) {
        for (const rule of orderBy.reverse()) {
          if (rule.sortOrder) {
            items = [...items].sort((a, b) =>
              rule.sortOrder === 'asc' ? a.sortOrder - b.sortOrder : b.sortOrder - a.sortOrder,
            );
          } else if (rule.name) {
            items = [...items].sort((a, b) =>
              rule.name === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
            );
          }
        }
      }
      return items.map((item) => ({ ...item }));
    },

    findFirst: async ({ where, select }: { where: { id?: string; userId?: string; kind?: CategoryKind }; select?: { id: boolean } }) => {
      const record = this.categories.find((cat) => {
        if (where.id && cat.id !== where.id) return false;
        if (where.userId && cat.userId !== where.userId) return false;
        if (where.kind && cat.kind !== where.kind) return false;
        return true;
      });
      if (!record) {
        return null;
      }
      if (select?.id) {
        return { id: record.id };
      }
      return { ...record };
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const index = this.categories.findIndex((cat) => cat.id === where.id);
      if (index === -1) {
        throw new Error('Category not found');
      }
      const record = this.categories[index];
      if (data.name !== undefined) {
        record.name = data.name;
      }
      if (data.kind !== undefined) {
        record.kind = data.kind;
      }
      if (data.sortOrder !== undefined) {
        record.sortOrder = data.sortOrder;
      }
      if (data.parentCategory?.disconnect) {
        record.parentCategoryId = null;
      }
      if (data.parentCategory?.connect) {
        record.parentCategoryId = data.parentCategory.connect.id;
      }
      this.categories[index] = record;
      return { ...record };
    },

    delete: async ({ where }: { where: { id: string } }) => {
      const index = this.categories.findIndex((cat) => cat.id === where.id);
      if (index === -1) {
        throw new Error('Category not found');
      }
      const [removed] = this.categories.splice(index, 1);
      return { ...removed };
    },

    count: async ({ where }: { where: { parentCategoryId: string; userId: string } }) => {
      return this.categories.filter(
        (cat) => cat.parentCategoryId === where.parentCategoryId && cat.userId === where.userId,
      ).length;
    },

    aggregate: async ({ where }: { where: { userId: string; parentCategoryId: string | null } }) => {
      const filtered = this.categories.filter(
        (cat) => cat.userId === where.userId && cat.parentCategoryId === where.parentCategoryId,
      );
      const max = filtered.length > 0 ? Math.max(...filtered.map((cat) => cat.sortOrder)) : null;
      return { _max: { sortOrder: max } };
    },
  };
}

class StubEvents {
  public emitted: Array<{ event: string; payload: unknown }> = [];
  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
  }
}

class StubUserContext {
  constructor(private readonly userId: string) {}
  getUserId() {
    return this.userId;
  }
}

function createService(prisma: CategoriesPrismaStub) {
  const events = new StubEvents();
  const userContext = new StubUserContext('user-123');
  const service = new CategoriesService(prisma as any, events as any, userContext as any);
  return { service, events, prisma };
}

async function testCreateAssignsSortOrderAndEmitsEvent() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Logement',
      kind: CategoryKind.EXPENSE,
      sortOrder: 1,
      parentCategoryId: null,
    },
  ]);
  const { service, events } = createService(prisma);

  const entity = await service.create({
    name: 'Courses',
  } as any);

  assert.equal(entity.sortOrder, 2);
  assert.equal(events.emitted.some((event) => event.event === 'category.created'), true);
}

async function testCreateRejectsTransferCategory() {
  const prisma = new CategoriesPrismaStub();
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.create({
        name: 'Virement',
        kind: CategoryKind.TRANSFER,
      } as any),
    BadRequestException,
  );
}

async function testCreateRejectsInitialCategory() {
  const prisma = new CategoriesPrismaStub();
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.create({
        name: 'Initial',
        kind: CategoryKind.INITIAL,
      } as any),
    BadRequestException,
  );
}

async function testCreateRejectsIncomeCategories() {
  const prisma = new CategoriesPrismaStub();
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.create({
        name: 'Revenus',
        kind: CategoryKind.INCOME,
      } as any),
    BadRequestException,
  );

  await assert.rejects(
    () =>
      service.create({
        name: 'Revenus+1',
        kind: CategoryKind.INCOME_PLUS_ONE,
      } as any),
    BadRequestException,
  );
}

async function testCreateWithParentRequiresOwnership() {
  const prisma = new CategoriesPrismaStub([]);
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.create({
        name: 'Child',
        parentCategoryId: 'unknown-parent',
      } as any),
    NotFoundException,
  );
}

async function testCreateWithParentAssignsNextSortOrder() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-parent',
      userId: 'user-123',
      name: 'Parent',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
    {
      id: 'cat-child-1',
      userId: 'user-123',
      name: 'Child1',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: 'cat-parent',
    },
  ]);
  const { service } = createService(prisma);

  const created = await service.create({
    name: 'Child2',
    parentCategoryId: 'cat-parent',
  } as any);

  assert.equal(created.parentCategoryId, 'cat-parent');
  assert.equal(created.sortOrder, 1);
}

async function testUpdateAllowsDisconnectParent() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Loisirs',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: 'cat-parent',
    },
    {
      id: 'cat-parent',
      userId: 'user-123',
      name: 'Parent',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service, events } = createService(prisma);

  const entity = await service.update('cat-1', {
    name: 'Loisirs modifiés',
    parentCategoryId: null,
  } as any);

  assert.equal(entity.parentCategoryId, null);
  assert.equal(entity.name, 'Loisirs modifiés');
  assert.equal(events.emitted.some((event) => event.event === 'category.updated'), true);
}

async function testUpdateRejectsChangingToTransferKind() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Loisirs',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.update('cat-1', {
        kind: CategoryKind.TRANSFER,
      } as any),
    BadRequestException,
  );
}

async function testUpdateRejectsSelfParent() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Expense',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.update('cat-1', {
        parentCategoryId: 'cat-1',
      } as any),
    BadRequestException,
  );
}

async function testUpdateRejectsTransferCategoryModification() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-transfer',
      userId: 'user-123',
      name: 'Virement',
      kind: CategoryKind.TRANSFER,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.update('cat-transfer', {
        name: 'New name',
      } as any),
    BadRequestException,
  );
}

async function testUpdateRejectsInitialCategoryModification() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-initial',
      userId: 'user-123',
      name: 'Initial',
      kind: CategoryKind.INITIAL,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.update('cat-initial', {
        name: 'New name',
      } as any),
    BadRequestException,
  );
}

async function testUpdateRejectsIncomeCategoryModification() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-income',
      userId: 'user-123',
      name: 'Income',
      kind: CategoryKind.INCOME,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.update('cat-income', {
        name: 'New name',
      } as any),
    BadRequestException,
  );
}

async function testUpdateRejectsSettingKindToIncome() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Expense',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.update('cat-1', {
        kind: CategoryKind.INCOME,
      } as any),
    BadRequestException,
  );
}

async function testUpdateRejectsSettingKindToInitial() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Expense',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.update('cat-1', {
        kind: CategoryKind.INITIAL,
      } as any),
    BadRequestException,
  );
}

async function testFindAllReturnsSortedList() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-2',
      userId: 'user-123',
      name: 'B',
      kind: CategoryKind.EXPENSE,
      sortOrder: 2,
      parentCategoryId: null,
    },
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'A',
      kind: CategoryKind.EXPENSE,
      sortOrder: 1,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  const items = await service.findAll();
  assert.equal(items[0].name, 'A');
  assert.equal(items[1].name, 'B');
}

async function testFindOneThrowsWhenMissing() {
  const prisma = new CategoriesPrismaStub();
  const { service } = createService(prisma);

  await assert.rejects(() => service.findOne('missing'), NotFoundException);
}

async function testFindOneReturnsCategory() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Expense',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  const category = await service.findOne('cat-1');
  assert.equal(category.name, 'Expense');
}

async function testUpdateConnectsNewParent() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-child',
      userId: 'user-123',
      name: 'Child',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
    {
      id: 'cat-parent',
      userId: 'user-123',
      name: 'Parent',
      kind: CategoryKind.EXPENSE,
      sortOrder: 1,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  const updated = await service.update('cat-child', {
    parentCategoryId: 'cat-parent',
  } as any);
  assert.equal(updated.parentCategoryId, 'cat-parent');
}

async function testUpdateRejectsUnknownParent() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-child',
      userId: 'user-123',
      name: 'Child',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(
    () =>
      service.update('cat-child', {
        parentCategoryId: 'unknown',
      } as any),
    NotFoundException,
  );
}

async function testUpdateThrowsWhenCategoryMissing() {
  const prisma = new CategoriesPrismaStub();
  const { service } = createService(prisma);

  await assert.rejects(() => service.update('missing', {} as any), NotFoundException);
}

async function testCreateAcceptsProvidedSortOrder() {
  const prisma = new CategoriesPrismaStub();
  const { service } = createService(prisma);

  const entity = await service.create({
    name: 'Custom',
    sortOrder: 42,
  } as any);

  assert.equal(entity.sortOrder, 42);
}

async function testRemovePreventsDeletingWithChildren() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Parent',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
    {
      id: 'cat-2',
      userId: 'user-123',
      name: 'Child',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: 'cat-1',
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(() => service.remove('cat-1'), BadRequestException);
}

async function testRemoveRejectsTransferCategory() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-transfer',
      userId: 'user-123',
      name: 'Virement',
      kind: CategoryKind.TRANSFER,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(() => service.remove('cat-transfer'), BadRequestException);
}

async function testRemoveRejectsInitialCategory() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-initial',
      userId: 'user-123',
      name: 'Initial',
      kind: CategoryKind.INITIAL,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(() => service.remove('cat-initial'), BadRequestException);
}

async function testRemoveRejectsIncomeCategory() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-income',
      userId: 'user-123',
      name: 'Income',
      kind: CategoryKind.INCOME,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await assert.rejects(() => service.remove('cat-income'), BadRequestException);
}

async function testRemoveDeletesAndEmitsEvent() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Parent',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service, events } = createService(prisma);

  const entity = await service.remove('cat-1');
  assert.equal(entity.id, 'cat-1');
  assert.equal(events.emitted.some((event) => event.event === 'category.deleted'), true);
}

async function testRemoveThrowsWhenCategoryMissing() {
  const prisma = new CategoriesPrismaStub();
  const { service } = createService(prisma);

  await assert.rejects(() => service.remove('missing'), NotFoundException);
}


async function testUpdateSetsSortOrder() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Expense',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  const updated = await service.update('cat-1', {
    sortOrder: 5,
  } as any);

  assert.equal(updated.sortOrder, 5);
}


async function testCreateWithExplicitExpenseKind() {
  const prisma = new CategoriesPrismaStub();
  const { service } = createService(prisma);

  const entity = await service.create({
    name: 'Transport',
    kind: CategoryKind.EXPENSE,
  } as any);

  assert.equal(entity.kind, CategoryKind.EXPENSE);
}

async function testCreateSortOrderStartsAtZeroWhenEmpty() {
  const prisma = new CategoriesPrismaStub();
  const { service } = createService(prisma);

  const entity = await service.create({
    name: 'Premiere',
  } as any);

  assert.equal(entity.sortOrder, 0);
}

async function testUpdateAllowsExplicitKind() {
  const prisma = new CategoriesPrismaStub([
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Expense',
      kind: CategoryKind.EXPENSE,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  const updated = await service.update('cat-1', {
    kind: CategoryKind.EXPENSE,
  } as any);

  assert.equal(updated.kind, CategoryKind.EXPENSE);
}

(async () => {
  await testCreateAssignsSortOrderAndEmitsEvent();
  await testCreateWithExplicitExpenseKind();
  await testCreateSortOrderStartsAtZeroWhenEmpty();
  await testCreateRejectsTransferCategory();
  await testCreateRejectsInitialCategory();
  await testCreateRejectsIncomeCategories();
  await testCreateWithParentRequiresOwnership();
  await testCreateWithParentAssignsNextSortOrder();
  await testCreateAcceptsProvidedSortOrder();
  await testUpdateAllowsDisconnectParent();
  await testUpdateAllowsExplicitKind();
  await testUpdateConnectsNewParent();
  await testUpdateRejectsChangingToTransferKind();
  await testUpdateRejectsSelfParent();
  await testUpdateRejectsTransferCategoryModification();
  await testUpdateRejectsInitialCategoryModification();
  await testUpdateRejectsIncomeCategoryModification();
  await testUpdateRejectsSettingKindToIncome();
  await testUpdateRejectsSettingKindToInitial();
  await testUpdateSetsSortOrder();
  await testUpdateRejectsUnknownParent();
  await testUpdateThrowsWhenCategoryMissing();
  await testFindAllReturnsSortedList();
  await testFindOneThrowsWhenMissing();
  await testFindOneReturnsCategory();
  await testRemovePreventsDeletingWithChildren();
  await testRemoveRejectsTransferCategory();
  await testRemoveRejectsInitialCategory();
  await testRemoveRejectsIncomeCategory();
  await testRemoveDeletesAndEmitsEvent();
  await testRemoveThrowsWhenCategoryMissing();
  console.log('Categories service tests passed ✓');
})();
