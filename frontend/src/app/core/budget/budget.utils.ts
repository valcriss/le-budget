const MONTH_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getMonthFormatter(locale: string): Intl.DateTimeFormat {
  let formatter = MONTH_FORMATTER_CACHE.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
    MONTH_FORMATTER_CACHE.set(locale, formatter);
  }
  return formatter;
}

export function getCurrentMonthKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;
}

export function monthKeyToDate(monthKey: string): Date | null {
  const [yearStr, monthStr] = (monthKey ?? '').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, 1));
}

export function formatMonthLabel(monthKey: string, locale = 'fr-FR'): string {
  const date = monthKeyToDate(monthKey);
  if (!date) {
    return monthKey;
  }
  const formatted = getMonthFormatter(locale).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function normalizeMonthKey(input: string): string {
  if (!input) {
    throw new Error('monthKey is required');
  }
  const trimmed = input.trim();
  const match = /^(\d{4})-(\d{1,2})$/.exec(trimmed);
  if (!match) {
    return trimmed;
  }
  const [, year, month] = match;
  const monthNum = Number(month);
  if (monthNum < 1 || monthNum > 12) {
    return trimmed;
  }
  return `${year}-${monthNum.toString().padStart(2, '0')}`;
}

export function shiftMonthKey(monthKey: string, offset: number): string {
  const date = monthKeyToDate(monthKey);
  if (!date || !Number.isFinite(offset)) {
    return monthKey;
  }
  const newDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  return getCurrentMonthKey(new Date(Date.UTC(newDate.getUTCFullYear(), newDate.getUTCMonth(), 1)));
}
