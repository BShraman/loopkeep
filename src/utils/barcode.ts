import { Category } from '../types/Item';

/**
 * Expand an 8-digit UPC-E code (number system + 6 digits + check) to its
 * 12-digit UPC-A form. Returns null if the input isn't a valid UPC-E shape.
 */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0];
  const d = code.slice(1, 7);
  const check = code[7];
  const last = d[5];
  let body: string;
  if (last <= '2') {
    body = `${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`;
  } else if (last === '3') {
    body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  } else if (last === '4') {
    body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  } else {
    body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`;
  }
  return `${ns}${body}${check}`;
}

/**
 * Normalize a scanned code so the same product always produces the same
 * string, however the scanner reports it: UPC-A (12 digits) and UPC-E are
 * stored as 13-digit EAN with a leading 0, which is how iOS already reports
 * UPC-A. Anything else (EAN-8, Code 128, QR, …) is kept as-is, trimmed.
 */
export function normalizeBarcode(data: string, type?: string): string {
  const code = data.trim();
  const t = (type ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/^\d+$/.test(code)) {
    if (code.length === 8 && (t === 'upce' || t.endsWith('upce'))) {
      const upcA = expandUpcE(code);
      if (upcA) return `0${upcA}`;
    }
    if (code.length === 12 && (t === '' || t.endsWith('upca'))) return `0${code}`;
  }
  return code;
}

/** True for numeric retail codes a product database can look up (EAN-8/13, UPC). */
export function isRetailBarcode(code: string): boolean {
  return /^\d{8}$|^\d{12,14}$/.test(code);
}

const CATEGORY_KEYWORDS: { category: Category; words: string[] }[] = [
  // Checked in order: kitchen water filters before generic "filter" (HVAC).
  { category: 'Kitchen', words: ['refrigerator', 'fridge', 'water filter', 'pitcher', 'range hood', 'dishwasher'] },
  { category: 'Safety', words: ['battery', 'batteries', 'smoke', 'carbon monoxide', 'detector', 'alarm', 'extinguisher'] },
  { category: 'Plumbing', words: ['softener', 'salt', 'shower', 'faucet', 'water heater', 'cartridge', 'sediment'] },
  { category: 'HVAC', words: ['furnace', 'hvac', 'air filter', 'ac filter', 'merv', 'filter', 'humidifier', 'purifier'] },
];

/** Best-guess category from a product title; 'Other' when nothing matches. */
export function guessCategory(title: string): Category {
  const t = title.toLowerCase();
  for (const { category, words } of CATEGORY_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return category;
  }
  return 'Other';
}
