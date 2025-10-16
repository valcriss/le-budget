import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetMenu } from './budget-menu';

describe('BudgetMenu', () => {
  let component: BudgetMenu;
  let fixture: ComponentFixture<BudgetMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetMenu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BudgetMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
