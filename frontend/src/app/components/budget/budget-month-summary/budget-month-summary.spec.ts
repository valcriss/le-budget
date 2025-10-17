import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetMonthSummary } from './budget-month-summary';

describe('BudgetMonthSummary', () => {
  let component: BudgetMonthSummary;
  let fixture: ComponentFixture<BudgetMonthSummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetMonthSummary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BudgetMonthSummary);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
