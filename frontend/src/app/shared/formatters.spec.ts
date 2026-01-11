import {
  formatCurrency,
  formatCurrencyWithSign,
  getAmountClass,
  toNumber,
} from './formatters';

describe('formatters', () => {
  it('converts mixed inputs to numbers', () => {
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(123)).toBe(123);
    expect(toNumber(' 1 234,56 € ')).toBeCloseTo(1234.56);
    expect(toNumber('42')).toBe(42);
    expect(toNumber('invalid')).toBe(0);
  });

  it('formats currency using french locale semantics', () => {
    const expected = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1234.56);
    expect(formatCurrency(1234.56)).toBe(expected);
    expect(formatCurrency(-10)).toContain('-');
  });

  it('falls back to manual formatting when Intl fails', () => {
    const spy = jest
      .spyOn(Intl, 'NumberFormat')
      .mockImplementation(() => {
        throw new Error('boom');
      });

    try {
      expect(formatCurrency(12.5)).toBe('12,50 €');
    } finally {
      spy.mockRestore();
    }
  });

  it('adds plus sign and hides zero when requested', () => {
    expect(formatCurrencyWithSign(10, true)).toMatch(/^\+\s/);
    expect(formatCurrencyWithSign(0, true, true)).toBe('');
    expect(formatCurrencyWithSign(10, false)).not.toMatch(/^\+\s/);
    expect(formatCurrencyWithSign(-10, true)).toContain('-');
    expect(formatCurrencyWithSign(10, false, false)).toContain('10');
  });

  it('returns the right css class for amounts', () => {
    expect(getAmountClass(10)).toBe('text-emerald-600');
    expect(getAmountClass(-5)).toBe('text-rose-600');
    expect(getAmountClass(0)).toBe('text-gray-500');
  });
});
