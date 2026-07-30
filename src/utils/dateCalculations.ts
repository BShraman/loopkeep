import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { Item, ItemStatus } from '../types/Item';

export function getDueDate(item: Pick<Item, 'lastReplacedDate' | 'intervalDays'>): Date {
  return addDays(startOfDay(parseISO(item.lastReplacedDate)), item.intervalDays);
}

export function getDaysUntilDue(item: Pick<Item, 'lastReplacedDate' | 'intervalDays'>): number {
  return differenceInCalendarDays(getDueDate(item), startOfDay(new Date()));
}

export function getStatus(
  item: Pick<Item, 'lastReplacedDate' | 'intervalDays' | 'reminderLeadDays'>
): ItemStatus {
  const daysUntilDue = getDaysUntilDue(item);
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= item.reminderLeadDays) return 'dueSoon';
  return 'ok';
}

export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), 'MMM d, yyyy');
}

export function formatDueDate(item: Pick<Item, 'lastReplacedDate' | 'intervalDays'>): string {
  return format(getDueDate(item), 'MMM d, yyyy');
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Human summary like "Overdue by 3 days", "Due in 5 days", "Due today". */
export function dueSummary(item: Pick<Item, 'lastReplacedDate' | 'intervalDays'>): string {
  const days = getDaysUntilDue(item);
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Fraction (0–1) of the replacement interval that has elapsed. 0 = just
 * replaced, 1 = due (or overdue — clamped). Drives the time-until-due bar.
 */
export function getDueProgress(item: Pick<Item, 'lastReplacedDate' | 'intervalDays'>): number {
  if (item.intervalDays <= 0) return 1;
  const elapsed = item.intervalDays - getDaysUntilDue(item);
  return Math.max(0, Math.min(1, elapsed / item.intervalDays));
}
