import { ElementRef } from '@angular/core';
import { BudgetStatus } from './budget-status';

describe('BudgetStatus', () => {
  let component: BudgetStatus;
  let focusTrapFactory: { create: jest.Mock };
  let trap: { focusInitialElement: jest.Mock; destroy: jest.Mock };

  beforeEach(() => {
    trap = {
      focusInitialElement: jest.fn(),
      destroy: jest.fn(),
    };
    focusTrapFactory = {
      create: jest.fn().mockReturnValue(trap),
    };
    component = new BudgetStatus(focusTrapFactory as any);
    component.root = new ElementRef(document.createElement('div'));
  });

  it('formats currency and classes via helper wrappers', () => {
    expect(component.formatCurrencyWithSign(100)).toContain('100');
    expect(component.getAvailableClass(10)).toBe('text-emerald-600');
  });

  it('computes totals from provided inputs', () => {
    component.carryover = 100;
    component.income = 50;
    component.totalAssigned = 80;
    component.totalActivity = -10;

    expect(component.resourcesTotal).toBe(150);
    expect(component.chargesTotal).toBe(80);
    expect(component.totalCharges).toBe(70);

    component.carryover = undefined as any;
    component.income = undefined as any;
    component.totalAssigned = undefined as any;
    component.totalActivity = undefined as any;

    expect(component.resourcesTotal).toBe(0);
    expect(component.chargesTotal).toBe(0);
    expect(component.totalCharges).toBe(0);
  });

  it('derives displayed available with multiple fallbacks', () => {
    component.totalAvailable = '200';
    expect(component.displayedAvailable).toBe(200);
    component.totalAvailable = 250;
    expect(component.displayedAvailable).toBe(250);
    component.totalAvailable = 'invalid' as any;
    expect(component.displayedAvailable).toBe(0);
    component.totalAvailable = undefined;
    component.available = '150';
    expect(component.displayedAvailable).toBe(150);
    component.available = 75;
    expect(component.displayedAvailable).toBe(75);
    component.available = 'invalid' as any;
    expect(component.displayedAvailable).toBe(0);
    component.available = undefined;
    expect(component.displayedAvailable).toBe(0);
  });

  it('skips focus trap creation when root is missing', () => {
    component.root = undefined;
    component.ngAfterViewInit();
    expect(focusTrapFactory.create).not.toHaveBeenCalled();
  });

  it('creates and initializes focus trap after view init', () => {
    jest.useFakeTimers();
    component.ngAfterViewInit();
    expect(focusTrapFactory.create).toHaveBeenCalledWith(component.root?.nativeElement);
    jest.runAllTimers();
    expect(trap.focusInitialElement).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('destroys focus trap on destroy', () => {
    component.ngAfterViewInit();
    component.ngOnDestroy();
    expect(trap.destroy).toHaveBeenCalled();
  });

  it('starts closing animation and resolves on animationend', async () => {
    const promise = component.startClose();
    expect(component.closing).toBe(true);
    component.root?.nativeElement.dispatchEvent(new Event('animationend'));
    await expect(promise).resolves.toBeUndefined();
  });

  it('ignores duplicate resolves after animation and timeout', async () => {
    jest.useFakeTimers();
    const promise = component.startClose();
    component.root?.nativeElement.dispatchEvent(new Event('animationend'));
    jest.advanceTimersByTime(500);
    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  it('resolves startClose when animation event never fires', async () => {
    jest.useFakeTimers();
    const promise = component.startClose();
    jest.advanceTimersByTime(500);
    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  it('ignores animation events from child elements', async () => {
    jest.useFakeTimers();
    const child = document.createElement('div');
    component.root?.nativeElement.appendChild(child);

    const promise = component.startClose();
    child.dispatchEvent(new Event('animationend', { bubbles: true }));
    jest.advanceTimersByTime(500);

    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  it('resolves immediately when root element missing', async () => {
    component.root = undefined;
    await expect(component.startClose()).resolves.toBeUndefined();
  });
});
