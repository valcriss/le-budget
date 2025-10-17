import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetMonthActions } from './budget-month-actions';

describe('BudgetMonthActions', () => {
  let component: BudgetMonthActions;
  let fixture: ComponentFixture<BudgetMonthActions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetMonthActions]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BudgetMonthActions);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
