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

  it('should compute month balance from income and activity', () => {
    component.incomesOfTheCurrentMonth = 1250.5;
    component.totalPaid = -423.4;

    expect(component.monthBalance).toBeCloseTo(827.1);
  });

  it('should treat undefined inputs as zero in month balance', () => {
    component.incomesOfTheCurrentMonth = undefined as any;
    component.totalPaid = undefined as any;

    expect(component.monthBalance).toBe(0);
  });

  it('should format currency without forcing sign', () => {
    expect(component.formatCurrencyWithSign(250)).toBe('250,00\u00a0€');
    expect(component.formatCurrencyWithSign(-45)).toBe('- 45,00\u00a0€');
  });

  it('should derive amount class from numeric value', () => {
    expect(component.getAmountClass(12)).toBe('text-emerald-600');
    expect(component.getAmountClass(-12)).toBe('text-rose-600');
    expect(component.getAmountClass(0)).toBe('text-gray-500');
  });
});
