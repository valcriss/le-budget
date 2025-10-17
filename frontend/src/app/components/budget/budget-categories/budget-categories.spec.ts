import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetCategories } from './budget-categories';

describe('BudgetCategories', () => {
  let component: BudgetCategories;
  let fixture: ComponentFixture<BudgetCategories>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetCategories],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetCategories);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
