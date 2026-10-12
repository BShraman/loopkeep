import { Category, Item, ReplacementHistory } from '../types/Item';

// Pure price math behind the item price trend and the dashboard spending card.
// Rows without a price are left out everywhere — never counted as zero.
// "Price" is what the part cost; "cost" adds any contractor / labor charge and
// is what spending totals use.

/** Price + contractor cost of one replacement, or null when neither was recorded. */
export function entryCost(h: Pick<ReplacementHistory, 'price' | 'labor'>): number | null {
  if (h.price == null && h.labor == null) return null;
  return (h.price ?? 0) + (h.labor ?? 0);
}

export interface PricePoint {
  date: string; // yyyy-MM-dd
  price: number; // cents
}

export interface ItemPriceStats {
  points: PricePoint[]; // oldest first
  last: number | null;
  previous: number | null;
  change: number | null; // last - previous, cents
  changePct: number | null; // e.g. 0.125 for +12.5%
  average: number | null;
  total: number; // everything spent on this item, contractor costs included
  annualCost: number | null;
}

/** Yearly cost of an item bought for `priceCents` every `intervalDays`. */
export function annualCost(priceCents: number, intervalDays: number): number | null {
  if (!(intervalDays > 0)) return null;
  return Math.round((priceCents * 365) / intervalDays);
}

/** Sort ascending by date; rows from the same day keep their given order. */
function byDateAsc<T extends { replacedDate: string }>(rows: T[]): T[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => a.row.replacedDate.localeCompare(b.row.replacedDate) || a.i - b.i)
    .map((x) => x.row);
}

/**
 * Price stats for one item. `history` may come in any order; for rows on the
 * same date, the later one in the input counts as more recent.
 */
export function itemPriceStats(history: ReplacementHistory[], intervalDays: number): ItemPriceStats {
  const points = byDateAsc(history.filter((h) => h.price != null)).map((h) => ({
    date: h.replacedDate,
    price: h.price as number,
  }));
  const n = points.length;
  const last = n > 0 ? points[n - 1].price : null;
  const previous = n > 1 ? points[n - 2].price : null;
  const change = last != null && previous != null ? last - previous : null;
  const changePct = change != null && previous ? change / previous : null;
  const priceTotal = points.reduce((sum, p) => sum + p.price, 0);
  const total = history.reduce((sum, h) => sum + (entryCost(h) ?? 0), 0);
  return {
    points,
    last,
    previous,
    change,
    changePct,
    average: n > 0 ? Math.round(priceTotal / n) : null,
    total,
    annualCost: last != null ? annualCost(last, intervalDays) : null,
  };
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MonthSpend {
  month: string; // yyyy-MM
  label: string; // "Jan"
  total: number; // cents
}

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/** `count` calendar months ending with `today`'s month, oldest first. */
export function monthWindow(today: Date, count: number, endOffset = 0): string[] {
  const keys: string[] = [];
  for (let i = count - 1 + endOffset; i >= endOffset; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    keys.push(monthKey(d.getFullYear(), d.getMonth()));
  }
  return keys;
}

/** Total spend per month for the `months` months ending this month, oldest first. */
export function monthlySpend(history: ReplacementHistory[], today: Date, months = 12): MonthSpend[] {
  const totals = new Map<string, number>();
  for (const h of history) {
    const cost = entryCost(h);
    if (cost == null) continue;
    const key = h.replacedDate.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + cost);
  }
  return monthWindow(today, months).map((month) => ({
    month,
    label: MONTH_LABELS[Number(month.slice(5, 7)) - 1],
    total: totals.get(month) ?? 0,
  }));
}

/** Latest recorded cost (price + contractor cost) per item id. */
export function lastCostByItem(history: ReplacementHistory[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const h of byDateAsc(history)) {
    const cost = entryCost(h);
    if (cost != null) map.set(h.itemId, cost);
  }
  return map;
}

/** Latest recorded price per item id. */
export function lastPriceByItem(history: ReplacementHistory[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const h of byDateAsc(history)) {
    if (h.price != null) map.set(h.itemId, h.price);
  }
  return map;
}

export interface ItemYearlyCost {
  item: Item;
  lastCost: number; // latest price + contractor cost
  annualCost: number;
}

export interface SpendingSummary {
  monthly: MonthSpend[];
  last12: number;
  prior12: number;
  change: number | null; // null when there was no spend in the prior 12 months
  changePct: number | null;
  projectedAnnual: number;
  unpricedItemCount: number;
  byItem: ItemYearlyCost[]; // highest yearly cost first
  byCategory: { category: Category; annualCost: number }[]; // highest first, zeros dropped
}

/** Everything the Spending card and screen show, from all history with a cost. */
export function spendingSummary(
  items: Item[],
  history: ReplacementHistory[],
  today: Date
): SpendingSummary {
  const priced = history.filter((h) => entryCost(h) != null);
  const inMonths = (keys: string[]) => {
    const set = new Set(keys);
    return priced
      .filter((h) => set.has(h.replacedDate.slice(0, 7)))
      .reduce((sum, h) => sum + (entryCost(h) as number), 0);
  };
  const last12 = inMonths(monthWindow(today, 12));
  const prior12 = inMonths(monthWindow(today, 12, 12));
  const change = prior12 > 0 ? last12 - prior12 : null;

  const lastCosts = lastCostByItem(priced);
  const byItem: ItemYearlyCost[] = [];
  let unpricedItemCount = 0;
  for (const item of items) {
    const lastCost = lastCosts.get(item.id);
    if (lastCost == null) {
      unpricedItemCount++;
      continue;
    }
    const yearly = annualCost(lastCost, item.intervalDays);
    if (yearly != null) byItem.push({ item, lastCost, annualCost: yearly });
  }
  byItem.sort((a, b) => b.annualCost - a.annualCost || a.item.name.localeCompare(b.item.name));

  const categoryTotals = new Map<Category, number>();
  for (const row of byItem) {
    categoryTotals.set(row.item.category, (categoryTotals.get(row.item.category) ?? 0) + row.annualCost);
  }
  const byCategory = [...categoryTotals.entries()]
    .filter(([, cost]) => cost > 0)
    .map(([category, cost]) => ({ category, annualCost: cost }))
    .sort((a, b) => b.annualCost - a.annualCost);

  return {
    monthly: monthlySpend(priced, today),
    last12,
    prior12,
    change,
    changePct: change != null ? change / prior12 : null,
    projectedAnnual: byItem.reduce((sum, r) => sum + r.annualCost, 0),
    unpricedItemCount,
    byItem,
    byCategory,
  };
}
