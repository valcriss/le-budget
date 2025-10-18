import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetCategoryActions } from './budget-category-actions';

describe('BudgetCategoryActions', () => {
  let component: BudgetCategoryActions;
  let fixture: ComponentFixture<BudgetCategoryActions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetCategoryActions]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BudgetCategoryActions);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
