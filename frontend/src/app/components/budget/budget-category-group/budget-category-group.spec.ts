import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetCategoryGroup } from './budget-category-group';

describe('BudgetCategoryGroup', () => {
  let component: BudgetCategoryGroup;
  let fixture: ComponentFixture<BudgetCategoryGroup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetCategoryGroup],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetCategoryGroup);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
