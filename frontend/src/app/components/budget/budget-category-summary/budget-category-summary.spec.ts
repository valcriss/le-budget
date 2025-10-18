import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetCategorySummary } from './budget-category-summary';

describe('BudgetCategorySummary', () => {
  let component: BudgetCategorySummary;
  let fixture: ComponentFixture<BudgetCategorySummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetCategorySummary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BudgetCategorySummary);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
