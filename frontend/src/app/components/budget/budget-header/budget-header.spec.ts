import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetHeader } from './budget-header';

describe('BudgetHeader', () => {
  let component: BudgetHeader;
  let fixture: ComponentFixture<BudgetHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetHeader],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetHeader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
