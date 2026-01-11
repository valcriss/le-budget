import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { InputAmount } from './input-amount';

describe('InputAmount', () => {
  let component: InputAmount;
  let fixture: ComponentFixture<InputAmount>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputAmount],
    }).compileComponents();

    fixture = TestBed.createComponent(InputAmount);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('enters edit mode and focuses the input', () => {
    jest.useFakeTimers();
    const inputEl = document.createElement('input');
    const focusSpy = jest.spyOn(inputEl, 'focus').mockImplementation(() => {});
    const selectSpy = jest.spyOn(inputEl, 'select').mockImplementation(() => {});
    component.amountInput = new ElementRef(inputEl);
    component.value = 123;

    component.enterEdit();
    jest.runAllTimers();

    expect(component.editing).toBe(true);
    expect(component.displayValue).toBe('123');
    expect(focusSpy).toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('defaults display value when no input value set', () => {
    component.value = undefined;
    component.enterEdit();
    expect(component.displayValue).toBe('');
  });

  it('finishes editing and emits numeric values', () => {
    const emitted: number[] = [];
    component.valueChange.subscribe((value) => emitted.push(value));

    component.finishEdit({ target: { value: '1 234,50 €' } });

    expect(component.value).toBeCloseTo(1234.5);
    expect(emitted).toEqual([1234.5]);
    expect(component.editing).toBe(false);
  });

  it('uses stored display value when event missing', () => {
    const emitted: number[] = [];
    component.valueChange.subscribe((value) => emitted.push(value));
    component.displayValue = '42';
    component.finishEdit();
    expect(component.value).toBe(42);
    expect(emitted).toEqual([42]);
  });

  it('handles keyboard interactions', () => {
    const finishSpy = jest.spyOn(component, 'finishEdit');

    component.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(finishSpy).toHaveBeenCalled();

    component.editing = true;
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.editing).toBe(false);
  });

  it('formats currency via helper', () => {
    expect(component.formatCurrencyWithSign(10)).toContain('10');
  });
});
