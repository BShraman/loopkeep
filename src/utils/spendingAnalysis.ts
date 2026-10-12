import { differenceInCalendarMonths, parseISO } from 'date-fns';
import { Category, Item, ReplacementHistory } from '../types/Item';
import { daysUntil, sortByUrgency } from './dashboard';
import {
  ItemYearlyCost,
  MonthSpend,
  entryCost,
  itemPriceStats,
  monthWindow,
  monthlySpend,
  spendingSummary,
} from './priceTrends';
import { toISODate } from './dateCalculations';

// Everything the Spending tab shows for one time range. Pure: pass `today`.

export type SpendingRange = 'year' | '12m' | 'all';

export interface CategorySpend {
  category: Category;
  total: number; // cents
  share: number; // 0–1 of the range total
}

export interface UpcomingCost {
  item: Item;
  days: number;
  expectedCost: number | null; // last recorded cost, null when never priced
}

export interface PriceChange {
  item: Item;
  previous: number;
  last: number;
  previousDate: string; // yyyy-MM-dd
  changePct: number;
}

export interface SpendingAnalysis {
  range: SpendingRange;
  total: number;
  previousTotal: number | null; // same span one year earlier; null for "all time"
  change: number | null; // null when there is nothing to compare against
  changePct: number | null;
  months: MonthSpend[];
  monthlyAverage: number;
  biggestMonth: MonthSpend | null;
  byCategory: CategorySpend[]; // largest first, zeros dropped
  partsTotal: number;
  laborTotal: number;
  projectedAnnual: number;
  byItem: ItemYearlyCost[];
  unpricedItemCount: number;
  comingUp: UpcomingCost[]; // due in the next `COMING_UP_DAYS`, overdue included
  comingUpTotal: number; // priced items only
  priceChanges: PriceChange[]; // biggest moves first
}

export const COMING_UP_DAYS = 60;
const MAX_ALL_TIME_MONTHS = 36;

function inRange(range: SpendingRange, today: Date): (date: string) => boolean {
  const todayIso = toISODate(today);
  if (range === 'year') {
    const start = `${today.getFullYear()}-01-01`;
    return (d) => d >= start && d <= todayIso;
  }
  if (range === '12m') {
    const months = new Set(monthWindow(today, 12));
    return (d) => months.has(d.slice(0, 7)) && d <= todayIso;
  }
  return (d) => d <= todayIso;
}

/** The same span one year earlier, or null when there is no fair comparison. */
function previousRange(range: SpendingRange, today: Date): ((date: string) => boolean) | null {
  if (range === 'year') {
    const y = today.getFullYear() - 1;
    const start = `${y}-01-01`;
    const end = `${y}${toISODate(today).slice(4)}`; // same month-day last year
    return (d) => d >= start && d <= end;
  }
  if (range === '12m') {
    const months = new Set(monthWindow(today, 12, 12));
    return (d) => months.has(d.slice(0, 7));
  }
  return null;
}

function monthCount(range: SpendingRange, today: Date, priced: ReplacementHistory[]): number {
  if (range === 'year') return today.getMonth() + 1;
  if (range === '12m') return 12;
  const earliest = priced.reduce<string | null>(
    (min, h) => (min == null || h.replacedDate < min ? h.replacedDate : min),
    null
  );
  if (!earliest) return 12;
  const span = differenceInCalendarMonths(today, parseISO(earliest)) + 1;
  return Math.min(Math.max(span, 1), MAX_ALL_TIME_MONTHS);
}

export function spendingAnalysis(
  items: Item[],
  history: ReplacementHistory[],
  today: Date,
  range: SpendingRange
): SpendingAnalysis {
  const priced = history.filter((h) => entryCost(h) != null);
  const within = inRange(range, today);
  const rows = priced.filter((h) => within(h.replacedDate));
  const sum = (list: ReplacementHistory[]) => list.reduce((s, h) => s + (entryCost(h) as number), 0);

  const total = sum(rows);
  const prev = previousRange(range, today);
  const previousTotal = prev ? sum(priced.filter((h) => prev(h.replacedDate))) : null;
  const change = previousTotal ? total - previousTotal : null;

  const months = monthlySpend(rows, today, monthCount(range, today, priced));
  const biggest = months.reduce<MonthSpend | null>((b, m) => (m.total > (b?.total ?? 0) ? m : b), null);

  const itemsById = new Map(items.map((i) => [i.id, i]));
  const categoryTotals = new Map<Category, number>();
  let partsTotal = 0;
  let laborTotal = 0;
  for (const h of rows) {
    partsTotal += h.price ?? 0;
    laborTotal += h.labor ?? 0;
    const item = itemsById.get(h.itemId);
    if (!item) continue; // spend on a deleted item still counts in the total
    categoryTotals.set(item.category, (categoryTotals.get(item.category) ?? 0) + (entryCost(h) as number));
  }
  const byCategory = [...categoryTotals.entries()]
    .filter(([, t]) => t > 0)
    .map(([category, t]) => ({ category, total: t, share: total > 0 ? t / total : 0 }))
    .sort((a, b) => b.total - a.total);

  const summary = spendingSummary(items, history, today);
  const lastCost = new Map(summary.byItem.map((r) => [r.item.id, r.lastCost]));
  const comingUp = sortByUrgency(items, today)
    .map((item) => ({ item, days: daysUntil(item, today), expectedCost: lastCost.get(item.id) ?? null }))
    .filter((x) => x.days <= COMING_UP_DAYS);

  const historyByItem = new Map<string, ReplacementHistory[]>();
  for (const h of history) {
    const list = historyByItem.get(h.itemId) ?? [];
    list.push(h);
    historyByItem.set(h.itemId, list);
  }
  const priceChanges: PriceChange[] = [];
  for (const item of items) {
    const stats = itemPriceStats(historyByItem.get(item.id) ?? [], item.intervalDays);
    if (stats.changePct == null || stats.change === 0 || stats.previous == null || stats.last == null) continue;
    priceChanges.push({
      item,
      previous: stats.previous,
      last: stats.last,
      previousDate: stats.points[stats.points.length - 2].date,
      changePct: stats.changePct,
    });
  }
  priceChanges.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  return {
    range,
    total,
    previousTotal,
    change,
    changePct: change != null && previousTotal ? change / previousTotal : null,
    months,
    monthlyAverage: months.length > 0 ? Math.round(total / months.length) : 0,
    biggestMonth: biggest,
    byCategory,
    partsTotal,
    laborTotal,
    projectedAnnual: summary.projectedAnnual,
    byItem: summary.byItem,
    unpricedItemCount: summary.unpricedItemCount,
    comingUp,
    comingUpTotal: comingUp.reduce((s, x) => s + (x.expectedCost ?? 0), 0),
    priceChanges,
  };
}

const MONTH_NAMES: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};

const PERIOD: Record<SpendingRange, { since: string; compare: string }> = {
  year: { since: 'since January', compare: 'this time last year' },
  '12m': { since: 'in the last 12 months', compare: 'the 12 months before' },
  all: { since: 'since you started tracking', compare: '' },
};

/** The plain-English "In short" paragraphs for the Spending tab. */
export function spendingInsights(a: SpendingAnalysis, money: (cents: number) => string): string[] {
  const period = PERIOD[a.range];
  if (a.total === 0) {
    return [
      `No spending recorded ${period.since} yet. Add a price when you mark something replaced and it will show up here.`,
    ];
  }
  const out: string[] = [];

  let first = `You've spent ${money(a.total)} on home upkeep ${period.since}`;
  if (a.change != null && a.change !== 0) {
    first += `, ${money(Math.abs(a.change))} ${a.change < 0 ? 'less' : 'more'} than ${period.compare}.`;
  } else if (a.change === 0) {
    first += `, the same as ${period.compare}.`;
  } else {
    first += '.';
  }
  out.push(first);

  const top = a.byCategory[0];
  const spendMonths = a.months.filter((m) => m.total > 0).length;
  const parts: string[] = [];
  if (top && a.byCategory.length > 1) {
    parts.push(`${top.category} is the biggest share, ${Math.round(top.share * 100)}% of it.`);
  } else if (top) {
    parts.push(`All of it went to ${top.category}.`);
  }
  if (a.biggestMonth && spendMonths > 1) {
    parts.push(`${MONTH_NAMES[a.biggestMonth.label]} was your biggest month at ${money(a.biggestMonth.total)}.`);
  }
  if (parts.length) out.push(parts.join(' '));

  const next: string[] = [];
  if (a.projectedAnnual > 0) {
    next.push(
      `Plan for about ${money(a.projectedAnnual)} over the next 12 months, roughly ${money(
        Math.round(a.projectedAnnual / 12)
      )} a month.`
    );
  }
  const pricedSoon = a.comingUp.filter((x) => x.expectedCost != null).length;
  if (pricedSoon > 0) {
    next.push(
      `${a.comingUp.length === 1 ? '1 thing is' : `${a.comingUp.length} things are`} due in the next ${COMING_UP_DAYS} days, about ${money(a.comingUpTotal)}.`
    );
  }
  if (next.length) out.push(next.join(' '));

  return out;
}
