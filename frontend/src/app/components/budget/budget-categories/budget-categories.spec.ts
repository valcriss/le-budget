import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { signal } from '@angular/core';

import { BudgetCategories } from './budget-categories';
import { CategoriesStore } from '../../../core/categories/categories.store';
import { BudgetStore } from '../../../core/budget/budget.store';

describe('BudgetCategories', () => {
  let component: BudgetCategories;
  let fixture: ComponentFixture<BudgetCategories>;

  beforeEach(async () => {
    const categoriesStoreMock = {
      error: signal<string | null>(null),
      update: jest.fn().mockResolvedValue(undefined),
    } satisfies Partial<CategoriesStore>;
    const budgetStoreMock = {
      reloadCurrentMonth: jest.fn().mockResolvedValue(undefined),
      monthKey: signal('2024-01'),
      updateCategoryAssigned: jest.fn().mockResolvedValue(undefined),
      error: signal<string | null>(null),
    } satisfies Partial<BudgetStore>;

    await TestBed.configureTestingModule({
      imports: [BudgetCategories],
      providers: [
        {
          provide: Dialog,
          useValue: { open: jest.fn().mockName('open') },
        },
        { provide: CategoriesStore, useValue: categoriesStoreMock },
        { provide: BudgetStore, useValue: budgetStoreMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetCategories);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
