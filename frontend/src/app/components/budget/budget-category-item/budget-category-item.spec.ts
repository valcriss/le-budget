import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetCategoryItem } from './budget-category-item';

describe('BudgetCategoryItem', () => {
  let component: BudgetCategoryItem;
  let fixture: ComponentFixture<BudgetCategoryItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetCategoryItem],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetCategoryItem);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
