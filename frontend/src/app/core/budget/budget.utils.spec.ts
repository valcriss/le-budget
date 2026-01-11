import {
  formatMonthLabel,
  getCurrentMonthKey,
  monthKeyToDate,
  normalizeMonthKey,
  shiftMonthKey,
} from './budget.utils';

describe('budget utils', () => {
  it('builds current month key with zero-padding', () => {
    const key = getCurrentMonthKey(new Date('2024-02-10T12:00:00Z'));
    expect(key).toBe('2024-02');
  });

  it('converts month keys to dates and returns null for invalid keys', () => {
    const date = monthKeyToDate('2024-05');
    expect(date).toBeInstanceOf(Date);
    expect(date?.getUTCFullYear()).toBe(2024);
    expect(date?.getUTCMonth()).toBe(5 - 1);

    expect(monthKeyToDate('2024-13')).toBeNull();
    expect(monthKeyToDate('invalid')).toBeNull();
    expect(monthKeyToDate(undefined as unknown as string)).toBeNull();
  });

  it('formats month labels using cached Intl formatter', () => {
    const NativeFormatter = Intl.DateTimeFormat;
    const expected = new NativeFormatter('fr-FR', {
      month: 'long',
      year: 'numeric',
    })
      .format(new Date(Date.UTC(2024, 5, 1)))
      .replace(/^./, (char) => char.toUpperCase());
    const formatterSpy = jest
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation((...args) => new NativeFormatter(...args));

    const label = formatMonthLabel('2024-06', 'fr-FR');
    expect(label).toBe(expected);
    // second call should reuse cached formatter
    formatMonthLabel('2024-07', 'fr-FR');
    const creationCalls = formatterSpy.mock.calls.filter(([locale]) => locale === 'fr-FR');
    expect(creationCalls.length).toBe(1);
    expect(formatMonthLabel('invalid', 'fr-FR')).toBe('invalid');
    formatterSpy.mockRestore();
  });

  it('normalizes month keys and validates ranges', () => {
    expect(() => normalizeMonthKey('')).toThrow('monthKey is required');
    expect(normalizeMonthKey('2024-3')).toBe('2024-03');
    expect(normalizeMonthKey(' 2024-11 ')).toBe('2024-11');
    expect(normalizeMonthKey('2024-13')).toBe('2024-13');
    expect(normalizeMonthKey('custom')).toBe('custom');
  });

  it('shifts month keys when possible and keeps invalid inputs unchanged', () => {
    expect(shiftMonthKey('2024-01', 1)).toBe('2024-02');
    expect(shiftMonthKey('2024-01', -1)).toBe('2023-12');
    expect(shiftMonthKey('invalid', 1)).toBe('invalid');
    expect(shiftMonthKey('2024-01', Number.NaN)).toBe('2024-01');
  });
});
