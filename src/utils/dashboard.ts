import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { Item, ItemStatus } from '../types/Item';
import { getDueDate } from './dateCalculations';

// Pure logic behind the dashboard: ordering, the adaptive headline, the week
// strip and the ring counts. Everything takes `today` so it can be tested.

export function daysUntil(item: Pick<Item, 'lastReplacedDate' | 'intervalDays'>, today: Date): number {
  return differenceInCalendarDays(getDueDate(item), startOfDay(today));
}

export function statusOn(
  item: Pick<Item, 'lastReplacedDate' | 'intervalDays' | 'reminderLeadDays'>,
  today: Date
): ItemStatus {
  const d = daysUntil(item, today);
  if (d < 0) return 'overdue';
  if (d <= item.reminderLeadDays) return 'dueSoon';
  return 'ok';
}

/**
 * Most urgent first. Items due the same day put Safety first (smoke and CO
 * detectors matter most), then go alphabetically.
 */
export function sortByUrgency(items: Item[], today: Date): Item[] {
  return [...items].sort(
    (a, b) =>
      daysUntil(a, today) - daysUntil(b, today) ||
      Number(b.category === 'Safety') - Number(a.category === 'Safety') ||
      a.name.localeCompare(b.name)
  );
}

export type HeadlineTone = 'overdue' | 'dueSoon' | 'ok' | 'neutral';

export interface Headline {
  title: string;
  detail: string;
  tone: HeadlineTone;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/**
 * The dashboard headline. It looks at the most urgent window that has
 * anything in it: overdue, then today, this week, the next 30 days, and
 * finally whatever is next at all.
 */
export function dashboardHeadline(items: Item[], today: Date): Headline {
  if (items.length === 0) {
    return { title: 'Let’s add your first item', detail: 'Scan a filter or battery to start', tone: 'neutral' };
  }
  const sorted = sortByUrgency(items, today);
  const withDays = sorted.map((item) => ({ item, days: daysUntil(item, today) }));

  const overdue = withDays.filter((x) => x.days < 0);
  if (overdue.length === 1) {
    const { item, days } = overdue[0];
    return {
      title: `${item.name} is ${plural(-days, 'day')} late`,
      detail: 'Swap it today and you’re all set',
      tone: 'overdue',
    };
  }
  if (overdue.length > 1) {
    const oldest = [...overdue].sort((a, b) => a.days - b.days)[0];
    return {
      title: `${overdue.length} things are overdue`,
      detail: `${oldest.item.name} is the oldest, ${plural(-oldest.days, 'day')} late`,
      tone: 'overdue',
    };
  }

  const dueToday = withDays.filter((x) => x.days === 0);
  const later = withDays.filter((x) => x.days > 0);
  if (dueToday.length > 0) {
    const next = later[0];
    const detail =
      next && next.days < 7
        ? `Then nothing else until ${format(addDays(today, next.days), 'EEEE')}`
        : 'Then you’re clear for the week';
    return {
      title:
        dueToday.length === 1
          ? `${dueToday[0].item.name} is due today`
          : `${dueToday.length} things are due today`,
      detail: dueToday.length === 1 ? detail : joinNames(dueToday.map((x) => x.item.name)),
      tone: 'dueSoon',
    };
  }

  const thisWeek = later.filter((x) => x.days < 7);
  if (thisWeek.length > 0) {
    const first = thisWeek[0];
    const day = format(addDays(today, first.days), 'EEEE');
    return {
      title: 'All clear today',
      detail:
        thisWeek.length === 1
          ? `${first.item.name} is due ${day}`
          : `${first.item.name} on ${day}, plus ${thisWeek.length - 1} more this week`,
      tone: 'dueSoon',
    };
  }

  const soon = later.filter((x) => x.days <= 30);
  if (soon.length > 0) {
    const first = soon[0];
    const date = format(addDays(today, first.days), 'MMM d');
    return {
      title: 'You’re set for this week',
      detail:
        soon.length === 1
          ? `Next: ${first.item.name} on ${date}`
          : `${soon.length} things coming up, the first on ${date}`,
      tone: 'neutral',
    };
  }

  const next = later[0];
  return {
    title: 'All caught up',
    detail: `Next: ${next.item.name}, ${format(addDays(today, next.days), 'MMM d')}`,
    tone: 'ok',
  };
}

export interface RingCounts {
  overdue: number;
  dueSoon: number;
  ok: number;
  total: number;
  dueThisWeek: number; // not overdue, due within the next 7 days
}

export function ringCounts(items: Item[], today: Date): RingCounts {
  const counts = { overdue: 0, dueSoon: 0, ok: 0, total: items.length, dueThisWeek: 0 };
  for (const item of items) {
    counts[statusOn(item, today)]++;
    const d = daysUntil(item, today);
    if (d >= 0 && d < 7) counts.dueThisWeek++;
  }
  return counts;
}

export interface WeekDay {
  iso: string; // yyyy-MM-dd
  weekday: string; // "Sat"
  dayOfMonth: number;
  isToday: boolean;
  dueCount: number;
  // What the dot under the day shows: overdue work rolls onto today.
  marker: 'overdue' | 'due' | null;
}

/** Today and the 6 days after it, with what's due on each. */
export function weekStrip(items: Item[], today: Date): WeekDay[] {
  const start = startOfDay(today);
  const anyOverdue = items.some((i) => daysUntil(i, start) < 0);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(start, offset);
    const dueCount = items.filter((i) => daysUntil(i, start) === offset).length;
    const isToday = offset === 0;
    return {
      iso: format(date, 'yyyy-MM-dd'),
      weekday: format(date, 'EEE'),
      dayOfMonth: date.getDate(),
      isToday,
      dueCount,
      marker: isToday && anyOverdue ? 'overdue' : dueCount > 0 ? 'due' : null,
    };
  });
}

/** Short due text for a tile: "3 days late", "Today", "Tomorrow", "In 6 days", "Dec 10". */
export function shortDue(item: Pick<Item, 'lastReplacedDate' | 'intervalDays'>, today: Date): string {
  const d = daysUntil(item, today);
  if (d < 0) return `${plural(-d, 'day')} late`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d < 30) return `In ${d} days`;
  return format(addDays(startOfDay(today), d), 'MMM d');
}
