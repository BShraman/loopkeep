import { Item, ReplacementHistory } from '../../types/Item';
import { annualCost, entryCost, itemPriceStats, monthlySpend, spendingSummary } from '../priceTrends';

const h = (itemId: string, replacedDate: string, price?: number, id = `${itemId}-${replacedDate}`): ReplacementHistory => ({
  id,
  itemId,
  replacedDate,
  price,
});

const item = (id: string, intervalDays: number, category: Item['category'] = 'HVAC'): Item => ({
  id,
  name: id,
  category,
  lastReplacedDate: '2026-01-01',
  intervalDays,
  reminderEnabled: true,
  reminderLeadDays: 5,
  isCustom: true,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('annualCost', () => {
  it('scales the price to a year', () => {
    expect(annualCost(2400, 90)).toBe(9733);
    expect(annualCost(1000, 365)).toBe(1000);
  });

  it('is null for a zero or negative interval', () => {
    expect(annualCost(1000, 0)).toBeNull();
    expect(annualCost(1000, -5)).toBeNull();
  });
});

describe('itemPriceStats', () => {
  it('orders points oldest first and ignores unpriced rows', () => {
    const stats = itemPriceStats(
      [h('a', '2026-07-01', 2600), h('a', '2026-04-01'), h('a', '2026-01-01', 2400)],
      90
    );
    expect(stats.points).toEqual([
      { date: '2026-01-01', price: 2400 },
      { date: '2026-07-01', price: 2600 },
    ]);
    expect(stats.last).toBe(2600);
    expect(stats.previous).toBe(2400);
    expect(stats.change).toBe(200);
    expect(stats.changePct).toBeCloseTo(0.0833, 3);
    expect(stats.average).toBe(2500);
    expect(stats.total).toBe(5000);
    expect(stats.annualCost).toBe(annualCost(2600, 90));
  });

  it('handles one price and no prices', () => {
    const one = itemPriceStats([h('a', '2026-01-01', 1500)], 30);
    expect(one.last).toBe(1500);
    expect(one.change).toBeNull();
    const none = itemPriceStats([h('a', '2026-01-01')], 30);
    expect(none.points).toHaveLength(0);
    expect(none.last).toBeNull();
    expect(none.average).toBeNull();
    expect(none.total).toBe(0);
  });

  it('has no percent change when the previous price was zero', () => {
    const stats = itemPriceStats([h('a', '2026-01-01', 0), h('a', '2026-02-01', 500)], 30);
    expect(stats.change).toBe(500);
    expect(stats.changePct).toBeNull();
  });
});

describe('monthlySpend', () => {
  const today = new Date(2026, 1, 15); // Feb 2026

  it('covers 12 months ending this month, across the year boundary', () => {
    const months = monthlySpend([], today);
    expect(months).toHaveLength(12);
    expect(months[0].month).toBe('2025-03');
    expect(months[11].month).toBe('2026-02');
    expect(months[11].label).toBe('Feb');
    expect(months.every((m) => m.total === 0)).toBe(true);
  });

  it('sums priced rows per month and drops rows outside the window', () => {
    const months = monthlySpend(
      [
        h('a', '2026-02-01', 1000),
        h('b', '2026-02-20', 500),
        h('c', '2026-01-10'),
        h('d', '2025-12-31', 700),
        h('e', '2025-02-28', 9999),
      ],
      today
    );
    const byKey = Object.fromEntries(months.map((m) => [m.month, m.total]));
    expect(byKey['2026-02']).toBe(1500);
    expect(byKey['2026-01']).toBe(0);
    expect(byKey['2025-12']).toBe(700);
    expect(byKey['2025-02']).toBeUndefined();
  });
});

describe('spendingSummary', () => {
  const today = new Date(2026, 9, 10); // Oct 2026

  it('compares the last 12 months with the 12 before', () => {
    const s = spendingSummary(
      [item('a', 90)],
      [h('a', '2026-09-01', 3000), h('a', '2025-09-01', 2000), h('a', '2024-09-01', 99999)],
      today
    );
    expect(s.last12).toBe(3000);
    expect(s.prior12).toBe(2000);
    expect(s.change).toBe(1000);
    expect(s.changePct).toBeCloseTo(0.5);
  });

  it('has no change when nothing was spent in the prior year', () => {
    const s = spendingSummary([item('a', 90)], [h('a', '2026-09-01', 3000)], today);
    expect(s.change).toBeNull();
    expect(s.changePct).toBeNull();
  });

  it('projects yearly cost from latest prices and counts unpriced items', () => {
    const s = spendingSummary(
      [item('a', 90, 'HVAC'), item('b', 365, 'Kitchen'), item('c', 30, 'Safety'), item('z', 0)],
      [
        h('a', '2026-01-01', 2000),
        h('a', '2026-04-01', 2400),
        h('b', '2026-02-01', 5000),
        h('c', '2026-03-01'),
        h('z', '2026-03-01', 100),
      ],
      today
    );
    expect(s.unpricedItemCount).toBe(1); // c has no price; z has one but no usable interval
    expect(s.byItem.map((r) => r.item.id)).toEqual(['a', 'b']);
    expect(s.byItem[0].lastCost).toBe(2400);
    expect(s.projectedAnnual).toBe(annualCost(2400, 90)! + 5000);
    expect(s.byCategory).toEqual([
      { category: 'HVAC', annualCost: annualCost(2400, 90) },
      { category: 'Kitchen', annualCost: 5000 },
    ]);
  });
});

describe('contractor costs', () => {
  const withLabor = (itemId: string, date: string, price?: number, labor?: number): ReplacementHistory => ({
    ...h(itemId, date, price),
    labor,
  });

  it('adds price and labor, and is null when neither is set', () => {
    expect(entryCost({ price: 1000, labor: 500 })).toBe(1500);
    expect(entryCost({ labor: 500 })).toBe(500);
    expect(entryCost({})).toBeNull();
  });

  it('keeps the price trend on part price but counts labor in total spent', () => {
    const stats = itemPriceStats(
      [withLabor('a', '2026-01-01', 2000, 8000), withLabor('a', '2026-07-01', 2200)],
      180
    );
    expect(stats.points.map((p) => p.price)).toEqual([2000, 2200]);
    expect(stats.average).toBe(2100);
    expect(stats.total).toBe(12200);
  });

  it('counts labor-only jobs in monthly spend and the projection', () => {
    const today = new Date(2026, 9, 10);
    const s = spendingSummary([item('a', 365)], [withLabor('a', '2026-10-01', undefined, 12000)], today);
    expect(s.monthly[11].total).toBe(12000);
    expect(s.last12).toBe(12000);
    expect(s.projectedAnnual).toBe(12000);
    expect(s.unpricedItemCount).toBe(0);
  });
});
