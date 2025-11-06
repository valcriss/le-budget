import { DatePickerComponent } from './date-picker';

describe('DatePickerComponent', () => {
  let component: DatePickerComponent;
  let changeSpy: jest.Mock;
  let touchedSpy: jest.Mock;
  let closedSpy: jest.Mock;

  beforeEach(() => {
    component = new DatePickerComponent({
      addIcons: jest.fn(),
    } as any);
    changeSpy = jest.fn();
    touchedSpy = jest.fn();
    closedSpy = jest.fn();
    component.registerOnChange(changeSpy);
    component.registerOnTouched(touchedSpy);
    component.closed.subscribe(closedSpy);
  });

  it('writes values and keeps display in sync', () => {
    component.writeValue('2024-03-05');
    expect((component as any).value).toBe('2024-03-05');
    expect(component.displayValue).toBe('05/03/2024');
    expect(component.calendarWeeks.length).toBeGreaterThan(0);

    component.writeValue('05/04/2024');
    expect((component as any).value).toBe('2024-04-05');
    expect(component.displayValue).toBe('05/04/2024');
  });

  it('respects disabled state when toggling the datepicker', () => {
    component.setDisabledState(true);
    component.toggleDatepicker();
    expect(component.datePickerOpen).toBe(false);
    expect(closedSpy).not.toHaveBeenCalled();

    component.setDisabledState(false);
    component.toggleDatepicker();
    expect(component.datePickerOpen).toBe(true);
    component.toggleDatepicker();
    expect(component.datePickerOpen).toBe(false);
    expect(touchedSpy).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('changes calendar month and rebuilds calendar', () => {
    component.toggleDatepicker();
    const initialMonth = component.calendarViewDate.getMonth();
    component.changeCalendarMonth(1);
    expect(component.calendarViewDate.getMonth()).toBe((initialMonth + 1) % 12);
    expect(component.calendarWeeks.length).toBe(6);
  });

  it('selects a calendar date and emits the new value', () => {
    component.toggleDatepicker();
    const [firstWeek] = component.calendarWeeks;
    const selectable = firstWeek.find((day) => day.isCurrentMonth) ?? firstWeek[0];

    component.selectCalendarDate(selectable);

    expect(changeSpy).toHaveBeenCalledWith(selectable.iso);
    expect(component.datePickerOpen).toBe(false);
    expect(touchedSpy).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalledTimes(1);
  });

  it('provides month label formatted in french', () => {
    const label = component.getMonthYearLabel(new Date('2024-04-01'));
    expect(label.toLowerCase()).toContain('avril');
  });

  it('notifies touch on blur when picker closed', () => {
    component.datePickerOpen = false;
    component.onInputBlur();
    expect(touchedSpy).toHaveBeenCalled();
  });

  it('closes when clicking outside but not inside', () => {
    component.toggleDatepicker();

    const insideEvent = {
      target: { closest: jest.fn().mockReturnValue(document.createElement('div')) },
    } as unknown as MouseEvent;
    component.onDocumentClick(insideEvent);
    expect(component.datePickerOpen).toBe(true);

    const outsideEvent = {
      target: { closest: jest.fn().mockReturnValue(null) },
    } as unknown as MouseEvent;
    component.onDocumentClick(outsideEvent);
    expect(component.datePickerOpen).toBe(false);
    expect(closedSpy).toHaveBeenCalled();
  });

  it('parses various inputs into ISO dates', () => {
    const toIsoDate = (component as any).toIsoDate.bind(component);
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate('2024-03-05')).toBe('2024-03-05');
    expect(toIsoDate('05/03/2024')).toBe('2024-03-05');
    expect(toIsoDate('March 5, 2024')).toBe('2024-03-05');
    expect(toIsoDate('invalid')).toBeNull();
  });

  it('formats ISO dates back to dd/mm/yyyy', () => {
    const fromIsoDate = (component as any).fromIsoDate.bind(component);
    expect(fromIsoDate('2024-03-05')).toBe('05/03/2024');
    expect(fromIsoDate('invalid')).toBe('invalid');
  });

  it('converts ISO strings to Date objects and vice versa', () => {
    const isoToDate = (component as any).isoToDate.bind(component);
    const toIsoString = (component as any).toIsoString.bind(component);
    const date = isoToDate('2024-03-05');
    expect(date).toEqual(new Date(2024, 2, 5));
    expect(isoToDate('bad')).toBeNull();
    expect(toIsoString(new Date(2024, 0, 9))).toBe('2024-01-09');
  });

  it('builds calendar grids with selection and today flags', () => {
    const today = new Date();
    const isoToday = (component as any).toIsoString(today);
    (component as any).value = isoToday;
    const buildCalendar = (component as any).buildCalendar.bind(component);
    const calendar = buildCalendar(today);
    expect(calendar).toHaveLength(6);
    const flat = calendar.flat();
    expect(flat.some((day: any) => day.isCurrentMonth)).toBe(true);
    expect(flat.some((day: any) => day.isSelected)).toBe(true);
    expect(flat.some((day: any) => day.isToday)).toBe(true);
  });
});
