export function toNumber(value?: string | number): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value)
    .replace(/\u202F|\s/g, '')
    .replace(/€/g, '')
    .replace(/\u00A0/g, '')
    .trim();
  const normalized = cleaned.replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(value?: string | number): string {
  const n = toNumber(value);
  try {
    const formatter = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const positive = formatter.format(Math.abs(n));
    return n < 0 ? '- ' + positive : positive;
  } catch (e) {
    const fixed = n.toFixed(2).replace('.', ',');
    return fixed + ' €';
  }
}

export function formatCurrencyWithSign(value?: string | number, showPlus = true, hideZero = false): string {
  const n = toNumber(value);
  const rounded = Math.round(n * 100) / 100;
  const formatted = formatCurrency(n);
  if (n > 0) return showPlus ? '+ ' + formatted : formatted;
  if (hideZero && rounded === 0) return '';
  return formatted;
}

export function getAmountClass(value?: string | number): string {
  const n = toNumber(value);
  if (n > 0) return 'text-emerald-600';
  if (n < 0) return 'text-rose-600';
  return 'text-gray-500';
}
