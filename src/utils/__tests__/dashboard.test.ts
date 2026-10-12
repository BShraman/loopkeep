import { addDays, format } from 'date-fns';
import { Item } from '../../types/Item';
import { dashboardHeadline, ringCounts, shortDue, sortByUrgency, weekStrip } from '../dashboard';

// Sunday, Oct 11 2026.
const TODAY = new Date(2026, 9, 11);

/** An item due `dueIn` days from TODAY (negative = overdue). */
const item = (name: string, dueIn: number, category: Item['category'] = 'HVAC', intervalDays = 90): Item => ({
  id: name,
  name,
  category,
  lastReplacedDate: format(addDays(TODAY, dueIn - intervalDays), 'yyyy-MM-dd'),
  intervalDays,
  reminderEnabled: true,
  reminderLeadDays: 7,
  isCustom: true,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('sortByUrgency', () => {
  it('puts the most overdue first', () => {
    const sorted = sortByUrgency([item('B', 5), item('A', -1), item('C', -3)], TODAY);
    expect(sorted.map((i) => i.name)).toEqual(['C', 'A', 'B']);
  });

  it('breaks same-day ties with Safety first, then by name', () => {
    const sorted = sortByUrgency(
      [item('Zeta', 0, 'Other'), item('Smoke', 0, 'Safety'), item('Alpha', 0, 'HVAC'), item('CO', 0, 'Safety')],
      TODAY
    );
    expect(sorted.map((i) => i.name)).toEqual(['CO', 'Smoke', 'Alpha', 'Zeta']);
  });
});

describe('dashboardHeadline', () => {
  it('invites you to add an item when there are none', () => {
    expect(dashboardHeadline([], TODAY)).toEqual(expect.objectContaining({ title: 'Let’s add your first item' }));
  });

  it('names a single overdue item', () => {
    const h = dashboardHeadline([item('Smoke detector battery', -3), item('Filter', 6)], TODAY);
    expect(h.title).toBe('Smoke detector battery is 3 days late');
    expect(h.tone).toBe('overdue');
  });

  it('uses singular "day" for one day late', () => {
    expect(dashboardHeadline([item('Filter', -1)], TODAY).title).toBe('Filter is 1 day late');
  });

  it('counts several overdue items and names the oldest', () => {
    const h = dashboardHeadline([item('A', -1), item('B', -5), item('C', 2)], TODAY);
    expect(h.title).toBe('2 things are overdue');
    expect(h.detail).toBe('B is the oldest, 5 days late');
  });

  it('names what is due today and when the next thing is', () => {
    const h = dashboardHeadline([item('HVAC filter', 0), item('Fridge filter', 5)], TODAY);
    expect(h.title).toBe('HVAC filter is due today');
    expect(h.detail).toBe('Then nothing else until Friday');
  });

  it('says the week is clear after today when nothing else is close', () => {
    const h = dashboardHeadline([item('HVAC filter', 0), item('Salt', 40)], TODAY);
    expect(h.detail).toBe('Then you’re clear for the week');
  });

  it('lists several things due today', () => {
    const h = dashboardHeadline([item('A', 0), item('B', 0)], TODAY);
    expect(h.title).toBe('2 things are due today');
    expect(h.detail).toBe('A and B');
  });

  it('looks ahead to this week when today is clear', () => {
    const one = dashboardHeadline([item('HVAC filter', 6)], TODAY);
    expect(one).toEqual({ title: 'All clear today', detail: 'HVAC filter is due Saturday', tone: 'dueSoon' });

    const two = dashboardHeadline([item('HVAC filter', 2), item('Fridge filter', 6)], TODAY);
    expect(two.detail).toBe('HVAC filter on Tuesday, plus 1 more this week');
  });

  it('looks ahead to the next few weeks when this week is clear', () => {
    expect(dashboardHeadline([item('Fridge filter', 12)], TODAY)).toEqual({
      title: 'You’re set for this week',
      detail: 'Next: Fridge filter on Oct 23',
      tone: 'neutral',
    });
    expect(dashboardHeadline([item('A', 12), item('B', 20)], TODAY).detail).toBe(
      '2 things coming up, the first on Oct 23'
    );
  });

  it('says all caught up and names the next item when nothing is close', () => {
    expect(dashboardHeadline([item('Water softener salt', 60)], TODAY)).toEqual({
      title: 'All caught up',
      detail: 'Next: Water softener salt, Dec 10',
      tone: 'ok',
    });
  });
});

describe('ringCounts', () => {
  it('counts statuses and what is due this week', () => {
    const counts = ringCounts([item('A', -2), item('B', 3), item('C', 6), item('D', 30), item('E', 90)], TODAY);
    expect(counts).toEqual({ overdue: 1, dueSoon: 2, ok: 2, total: 5, dueThisWeek: 2 });
  });
});

describe('weekStrip', () => {
  it('covers today and the next 6 days and marks due days', () => {
    const week = weekStrip([item('A', 0), item('B', 6), item('C', 6)], TODAY);
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual(
      expect.objectContaining({ weekday: 'Sun', dayOfMonth: 11, isToday: true, dueCount: 1, marker: 'due' })
    );
    expect(week[6]).toEqual(expect.objectContaining({ weekday: 'Sat', dayOfMonth: 17, dueCount: 2, marker: 'due' }));
    expect(week[3].marker).toBeNull();
  });

  it('rolls overdue work onto today', () => {
    expect(weekStrip([item('A', -4)], TODAY)[0].marker).toBe('overdue');
  });
});

describe('shortDue', () => {
  it('reads naturally at each distance', () => {
    expect(shortDue(item('A', -3), TODAY)).toBe('3 days late');
    expect(shortDue(item('A', 0), TODAY)).toBe('Today');
    expect(shortDue(item('A', 1), TODAY)).toBe('Tomorrow');
    expect(shortDue(item('A', 6), TODAY)).toBe('In 6 days');
    expect(shortDue(item('A', 60), TODAY)).toBe('Dec 10');
  });
});
