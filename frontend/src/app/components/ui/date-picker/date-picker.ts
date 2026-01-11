import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  forwardRef,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import {
  FaIconLibrary,
  FontAwesomeModule,
} from '@fortawesome/angular-fontawesome';
import {
  faCalendarDays,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';

type CalendarDay = {
  iso: string;
  label: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
};

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.css',
  /* istanbul ignore next */
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(/* istanbul ignore next */ () => DatePickerComponent),
      /* istanbul ignore next */
      multi: true,
    },
  ],
})
export class DatePickerComponent implements ControlValueAccessor {
  @Input() placeholder = '';
  @Input() disabled = false;
  @Output() closed = new EventEmitter<void>();

  readonly weekdayLabels = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
  displayValue = '';
  datePickerOpen = false;
  calendarViewDate = new Date();
  calendarWeeks: CalendarDay[][] = [];

  private value: string | null = null;
  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  protected icCalendar = faCalendarDays;
  protected icChevronLeft = faChevronLeft;
  protected icChevronRight = faChevronRight;

  constructor(library: FaIconLibrary) {
    library.addIcons(faCalendarDays, faChevronLeft, faChevronRight);
  }

  // ControlValueAccessor implementation
  writeValue(value: string | null): void {
    this.setInternalValue(value, false);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggleDatepicker(event?: MouseEvent) {
    event?.stopPropagation();
    if (this.disabled) return;

    this.datePickerOpen = !this.datePickerOpen;
    if (this.datePickerOpen) {
      this.syncCalendarToValue();
    } else {
      this.notifyTouched();
      this.closed.emit();
    }
  }

  changeCalendarMonth(offset: number) {
    this.calendarViewDate = new Date(
      this.calendarViewDate.getFullYear(),
      this.calendarViewDate.getMonth() + offset,
      1
    );
    this.calendarWeeks = this.buildCalendar(this.calendarViewDate);
  }

  selectCalendarDate(day: CalendarDay) {
    this.setInternalValue(day.iso, true);
    this.datePickerOpen = false;
    this.calendarViewDate = this.isoToDate(day.iso) || this.calendarViewDate;
    this.calendarWeeks = this.buildCalendar(this.calendarViewDate);
    this.notifyTouched();
    this.closed.emit();
  }

  getMonthYearLabel(date: Date): string {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  onInputBlur() {
    if (!this.datePickerOpen) {
      this.notifyTouched();
    }
  }

  private setInternalValue(rawValue: string | null, emit: boolean) {
    const iso = this.toIsoDate(rawValue) || null;
    this.value = iso;
    this.displayValue = iso ? this.fromIsoDate(iso) : '';

    if (emit) {
      this.onChange(iso);
    }
    this.syncCalendarToValue();
  }

  private syncCalendarToValue() {
    const base =
      this.isoToDate(this.value) ||
      new Date();
    this.calendarViewDate = base;
    this.calendarWeeks = this.buildCalendar(base);
  }

  private buildCalendar(base: Date): CalendarDay[][] {
    const firstOfMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const startDate = new Date(firstOfMonth);
    startDate.setDate(startDate.getDate() - startOffset);

    const weeks: CalendarDay[][] = [];
    const todayIso = this.toIsoString(new Date());
    const selectedIso = this.value;
    const cursor = new Date(startDate);

    for (let week = 0; week < 6; week++) {
      const days: CalendarDay[] = [];
      for (let day = 0; day < 7; day++) {
        const iso = this.toIsoString(cursor);
        days.push({
          iso,
          label: cursor.getDate(),
          isCurrentMonth: cursor.getMonth() === base.getMonth(),
          isSelected: iso === selectedIso,
          isToday: iso === todayIso,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(days);
    }

    return weeks;
  }

  private toIsoDate(value: string | null): string | null {
    if (!value) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }

    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return this.toIsoString(parsed);
    }

    return null;
  }

  private fromIsoDate(iso: string): string {
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return iso;
  }

  private isoToDate(iso: string | null): Date | null {
    if (!iso) return null;
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  private toIsoString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private notifyTouched() {
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.datePickerOpen) return;
    const target = event.target as HTMLElement;
    if (target.closest('.date-picker')) return;
    this.datePickerOpen = false;
    this.notifyTouched();
    this.closed.emit();
  }
}
