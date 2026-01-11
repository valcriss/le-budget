import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  let component: Checkbox;
  let fixture: ComponentFixture<Checkbox>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Checkbox],
    }).compileComponents();

    fixture = TestBed.createComponent(Checkbox);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('toggles checked state and emits changes', () => {
    const emitted: boolean[] = [];
    component.checkedChange.subscribe((value) => emitted.push(value));

    component.toggle();
    expect(component.checked).toBe(true);
    expect(emitted).toEqual([true]);

    component.toggle();
    expect(component.checked).toBe(false);
    expect(emitted).toEqual([true, false]);
  });

  it('ignores toggle when disabled', () => {
    component.disabled = true;
    const emitSpy = jest.spyOn(component.checkedChange, 'emit');
    component.checked = false;
    component.toggle();
    expect(component.checked).toBe(false);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('handles keyboard activation for space and enter', () => {
    const toggleSpy = jest.spyOn(component, 'toggle');
    component.onKeydown(new KeyboardEvent('keydown', { key: ' ' }));
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(toggleSpy).toHaveBeenCalledTimes(2);
  });

  it('ignores unrelated key presses', () => {
    const toggleSpy = jest.spyOn(component, 'toggle');
    const event = new KeyboardEvent('keydown', { key: 'Tab' });
    const preventSpy = jest.spyOn(event, 'preventDefault');
    component.onKeydown(event);
    expect(toggleSpy).not.toHaveBeenCalled();
    expect(preventSpy).not.toHaveBeenCalled();
  });

  it('prevents key handling when disabled', () => {
    component.disabled = true;
    const toggleSpy = jest.spyOn(component, 'toggle');
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(toggleSpy).not.toHaveBeenCalled();
  });
});
