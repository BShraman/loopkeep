import { Item, ReplacementHistory } from '../../types/Item';
import { spendingAnalysis, spendingInsights } from '../spendingAnalysis';

const TODAY = new Date(2026, 9, 11); // Oct 11 2026

const item = (id: string, category: Item['category'], intervalDays: number, lastReplacedDate: string): Item => ({
  id,
  name: id,
  category,
  lastReplacedDate,
  intervalDays,
  reminderEnabled: true,
  reminderLeadDays: 5,
  isCustom: true,
  createdAt: '2025-01-01T00:00:00.000Z',
});

let n = 0;
const h = (itemId: string, replacedDate: string, price?: number, labor?: number): ReplacementHistory => ({
  id: `h${n++}`,
  itemId,
  replacedDate,
  price,
  labor,
});

const items = [
  item('HVAC filter', 'HVAC', 90, '2026-07-19'), // due Oct 17
  item('Fridge filter', 'Kitchen', 180, '2026-04-26'), // due Oct 23
  item('Salt', 'Plumbing', 365, '2026-02-01'), // unpriced, due next year
];

const history = [
  h('HVAC filter', '2025-08-01', 2000),
  h('HVAC filter', '2026-01-20', 2200),
  h('HVAC filter', '2026-04-20', 2200),
  h('HVAC filter', '2026-07-19', 2400),
  h('Fridge filter', '2025-10-30', 2600),
  h('Fridge filter', '2026-04-26', 2200, 3000),
  h('Salt', '2026-02-01'),
];

const money = (cents: number) => `$${Math.round(cents / 100)}`;

describe('spendingAnalysis', () => {
  it('totals this calendar year and compares with the same span last year', () => {
    const a = spendingAnalysis(items, history, TODAY, 'year');
    expect(a.total).toBe(2200 + 2200 + 2400 + 2200 + 3000);
    expect(a.previousTotal).toBe(2000); // Aug 2025 only; Oct 30 2025 is after Oct 11
    expect(a.change).toBe(12000 - 2000);
    expect(a.months).toHaveLength(10); // Jan..Oct
    expect(a.biggestMonth?.label).toBe('Apr');
    expect(a.monthlyAverage).toBe(1200);
  });

  it('splits parts and contractor costs', () => {
    const a = spendingAnalysis(items, history, TODAY, 'year');
    expect(a.partsTotal).toBe(9000);
    expect(a.laborTotal).toBe(3000);
  });

  it('breaks spending down by category, largest first', () => {
    const a = spendingAnalysis(items, history, TODAY, 'year');
    expect(a.byCategory.map((c) => c.category)).toEqual(['HVAC', 'Kitchen']);
    expect(a.byCategory[0].total).toBe(6800);
    expect(a.byCategory[0].share).toBeCloseTo(6800 / 12000);
  });

  it('has no comparison for all time', () => {
    const a = spendingAnalysis(items, history, TODAY, 'all');
    expect(a.total).toBe(2000 + 12000 + 2600);
    expect(a.previousTotal).toBeNull();
    expect(a.change).toBeNull();
    expect(a.months[0].month).toBe('2025-08');
  });

  it('lists what is due in the next 60 days with its expected cost', () => {
    const a = spendingAnalysis(items, history, TODAY, 'year');
    expect(a.comingUp.map((x) => [x.item.id, x.days, x.expectedCost])).toEqual([
      ['HVAC filter', 6, 2400],
      ['Fridge filter', 12, 5200],
    ]);
    expect(a.comingUpTotal).toBe(7600);
  });

  it('reports price changes, biggest move first', () => {
    const a = spendingAnalysis(items, history, TODAY, 'year');
    expect(a.priceChanges.map((p) => [p.item.id, p.previous, p.last, p.previousDate])).toEqual([
      ['Fridge filter', 2600, 2200, '2025-10-30'],
      ['HVAC filter', 2200, 2400, '2026-04-20'],
    ]);
  });
});

describe('spendingInsights', () => {
  it('writes a plain-English summary', () => {
    const lines = spendingInsights(spendingAnalysis(items, history, TODAY, 'year'), money);
    expect(lines[0]).toBe("You've spent $120 on home upkeep since January, $100 more than this time last year.");
    expect(lines[1]).toBe('HVAC is the biggest share, 57% of it. April was your biggest month at $74.');
    expect(lines[2]).toMatch(/^Plan for about \$\d+ over the next 12 months, roughly \$\d+ a month\. 2 things are due in the next 60 days, about \$76\.$/);
  });

  it('explains what to do when nothing was spent', () => {
    const lines = spendingInsights(spendingAnalysis(items, [], TODAY, '12m'), money);
    expect(lines).toEqual([
      'No spending recorded in the last 12 months yet. Add a price when you mark something replaced and it will show up here.',
    ]);
  });
});
