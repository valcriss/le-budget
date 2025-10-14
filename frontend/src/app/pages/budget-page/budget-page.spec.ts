import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetPage } from './budget-page';

describe('BudgetPage', () => {
  let component: BudgetPage;
  let fixture: ComponentFixture<BudgetPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BudgetPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
