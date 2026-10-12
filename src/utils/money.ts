// Prices are stored as whole cents (minor units) so totals never pick up
// floating-point drift. These helpers convert between what the user types,
// what is stored, and what is shown.

export const DEFAULT_CURRENCY = 'USD';

export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'US dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British pound' },
  { code: 'INR', label: 'Indian rupee' },
  { code: 'CAD', label: 'Canadian dollar' },
  { code: 'AUD', label: 'Australian dollar' },
  { code: 'NZD', label: 'New Zealand dollar' },
  { code: 'JPY', label: 'Japanese yen' },
  { code: 'CHF', label: 'Swiss franc' },
  { code: 'SGD', label: 'Singapore dollar' },
  { code: 'ZAR', label: 'South African rand' },
  { code: 'MXN', label: 'Mexican peso' },
  { code: 'BRL', label: 'Brazilian real' },
];

const MAX_CENTS = 10_000_000_00; // 10 million — anything above is a typo

/**
 * Parse a typed amount ("24", "24.5", "24,50", "$1,234.99") into cents.
 * Returns null for blank or unreadable input.
 */
export function parsePrice(text: string): number | null {
  let s = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: whichever comes last is the decimal separator.
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    s = s.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma >= 0) {
    // "24,50" is a decimal comma; "1,234" is a thousands separator.
    const commas = s.split(',').length - 1;
    s = commas === 1 && /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.split(',').join('');
  } else if (s.split('.').length - 1 > 1) {
    // "1.234.567" — dots used as thousands separators.
    s = s.split('.').join('');
  }

  if (!/^\d*\.?\d*$/.test(s) || s === '.') return null;
  const cents = Math.round(parseFloat(s) * 100);
  if (!Number.isFinite(cents) || cents < 0 || cents > MAX_CENTS) return null;
  return cents;
}

/** Cents → plain editable text, e.g. 2450 → "24.50", 2400 → "24". */
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Cents → "$24.50" in the given currency; `compact` drops the decimals ("$25"). */
export function formatMoney(cents: number, currency: string, compact = false): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      ...(compact ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
    }).format(amount);
  } catch {
    return `${currency} ${compact ? Math.round(amount) : amount.toFixed(2)}`;
  }
}
