import { addDays, subDays } from 'date-fns';
import {
  dueSummary,
  formatDate,
  getDaysUntilDue,
  getDueDate,
  getStatus,
  toISODate,
  todayISO,
} from '../dateCalculations';

// Freeze "today" so relative-date assertions are deterministic.
const FIXED_NOW = new Date('2026-07-18T14:30:00');

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

/** Build an item whose due date is `offsetDays` from today. */
function itemDueIn(offsetDays: number, intervalDays = 90, reminderLeadDays = 5) {
  const dueDate = addDays(new Date(FIXED_NOW), offsetDays);
  const lastReplaced = subDays(dueDate, intervalDays);
  return {
    lastReplacedDate: toISODate(lastReplaced),
    intervalDays,
    reminderLeadDays,
  };
}

describe('getDueDate', () => {
  it('is lastReplacedDate + intervalDays', () => {
    const due = getDueDate({ lastReplacedDate: '2026-01-01', intervalDays: 90 });
    expect(toISODate(due)).toBe('2026-04-01');
  });
});

describe('getDaysUntilDue', () => {
  it('is 0 when due today', () => {
    expect(getDaysUntilDue(itemDueIn(0))).toBe(0);
  });

  it('is negative when overdue', () => {
    expect(getDaysUntilDue(itemDueIn(-3))).toBe(-3);
  });

  it('is positive when in the future', () => {
    expect(getDaysUntilDue(itemDueIn(10))).toBe(10);
  });

  it('ignores time-of-day (calendar days only)', () => {
    // Due date is later today; still counts as 0 days, not fractional.
    expect(getDaysUntilDue(itemDueIn(0))).toBe(0);
  });
});

describe('getStatus', () => {
  it('overdue: due date is in the past', () => {
    expect(getStatus(itemDueIn(-1))).toBe('overdue');
  });

  it('dueSoon: due today', () => {
    expect(getStatus(itemDueIn(0))).toBe('dueSoon');
  });

  it('dueSoon: within reminderLeadDays', () => {
    expect(getStatus(itemDueIn(5, 90, 5))).toBe('dueSoon');
  });

  it('ok: just beyond reminderLeadDays', () => {
    expect(getStatus(itemDueIn(6, 90, 5))).toBe('ok');
  });

  it('respects a custom lead time', () => {
    expect(getStatus(itemDueIn(10, 90, 14))).toBe('dueSoon');
    expect(getStatus(itemDueIn(20, 90, 14))).toBe('ok');
  });
});

describe('dueSummary', () => {
  it('reads "Due today" at 0', () => {
    expect(dueSummary(itemDueIn(0))).toBe('Due today');
  });

  it('pluralizes overdue correctly', () => {
    expect(dueSummary(itemDueIn(-1))).toBe('Overdue by 1 day');
    expect(dueSummary(itemDueIn(-3))).toBe('Overdue by 3 days');
  });

  it('pluralizes upcoming correctly', () => {
    expect(dueSummary(itemDueIn(1))).toBe('Due in 1 day');
    expect(dueSummary(itemDueIn(7))).toBe('Due in 7 days');
  });
});

describe('date helpers', () => {
  it('todayISO reflects the frozen clock', () => {
    expect(todayISO()).toBe('2026-07-18');
  });

  it('formatDate renders a human date', () => {
    expect(formatDate('2026-07-18')).toBe('Jul 18, 2026');
  });
});
