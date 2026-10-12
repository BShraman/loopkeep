import { getSetting, setSetting } from '../db/database';
import { Category } from '../types/Item';
import { guessCategory, isRetailBarcode } from '../utils/barcode';

export const PRODUCT_LOOKUP_KEY = 'productLookupEnabled';

const LOOKUP_URL = 'https://api.upcitemdb.com/prod/trial/lookup?upc=';
const LOOKUP_TIMEOUT_MS = 4000;
const MAX_NAME_LENGTH = 60;

export interface ProductInfo {
  name: string;
  brand?: string;
  category: Category;
}

/** Online lookup is on unless the user has switched it off in Settings. */
export async function isProductLookupEnabled(): Promise<boolean> {
  return (await getSetting(PRODUCT_LOOKUP_KEY)) !== 'false';
}

export async function setProductLookupEnabled(enabled: boolean): Promise<void> {
  await setSetting(PRODUCT_LOOKUP_KEY, enabled ? 'true' : 'false');
}

function trimName(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_NAME_LENGTH) return clean;
  const cut = clean.slice(0, MAX_NAME_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Turn a UPCitemdb response body into ProductInfo, or null if it has no usable item. */
export function parseLookupResponse(body: unknown): ProductInfo | null {
  if (!body || typeof body !== 'object') return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const first = items[0] as Record<string, unknown>;
  const title = typeof first.title === 'string' ? first.title : '';
  if (!title.trim()) return null;
  const brand = typeof first.brand === 'string' && first.brand.trim() ? first.brand.trim() : undefined;
  const categoryHint = typeof first.category === 'string' ? first.category : '';
  return {
    name: trimName(title),
    brand,
    category: guessCategory(`${title} ${categoryHint}`),
  };
}

/**
 * Look a barcode up in UPCitemdb's free trial API. Only the barcode number is
 * sent. Never throws: returns null when lookup is off, the code isn't a retail
 * barcode, there's no connection, the request times out, or nothing is found —
 * the caller just falls back to a blank form.
 */
export async function lookupProduct(barcode: string): Promise<ProductInfo | null> {
  if (!isRetailBarcode(barcode)) return null;
  if (!(await isProductLookupEnabled())) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(`${LOOKUP_URL}${encodeURIComponent(barcode)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return parseLookupResponse(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
