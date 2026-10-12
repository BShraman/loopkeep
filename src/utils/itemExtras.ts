import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { Item } from '../types/Item';
import { getDueDate } from './dateCalculations';

// Pure helpers for spares, reordering and snoozing.

/** Spares are tracked for this item and none are left. */
export function needsRestock(item: Pick<Item, 'spares'>): boolean {
  return item.spares != null && item.spares <= 0;
}

/** "2 spares", "1 spare", "No spares left"; null when spares aren't tracked. */
export function sparesLabel(item: Pick<Item, 'spares'>): string | null {
  if (item.spares == null) return null;
  if (item.spares <= 0) return 'No spares left';
  return `${item.spares} spare${item.spares === 1 ? '' : 's'}`;
}

/**
 * Where the Reorder button goes: the saved link if there is one (https:// added
 * when missing), otherwise a shopping search for the barcode or the name.
 */
export function reorderUrlFor(item: Pick<Item, 'reorderUrl' | 'barcode' | 'name'>): string {
  const saved = item.reorderUrl?.trim();
  if (saved) return /^[a-z][a-z0-9+.-]*:\/\//i.test(saved) ? saved : `https://${saved}`;
  const query = item.barcode || item.name;
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}

/** Snooze is in effect: the snooze day is after `today` (yyyy-MM-dd). */
export function isSnoozed(item: Pick<Item, 'snoozedUntil'>, today: string): boolean {
  return !!item.snoozedUntil && item.snoozedUntil > today;
}

/** The yyyy-MM-dd date `days` after `today`. */
export function snoozeDate(today: Date, days: number): string {
  return format(addDays(startOfDay(today), days), 'yyyy-MM-dd');
}

/** "Snoozed until Oct 13". */
export function snoozeLabel(snoozedUntil: string): string {
  return `Snoozed until ${format(parseISO(snoozedUntil), 'MMM d')}`;
}

/**
 * When the item's reminder should fire, at 9:00 local time: on the snooze day
 * while snoozed, otherwise `reminderLeadDays` before the due date.
 */
export function reminderTriggerDate(
  item: Pick<Item, 'lastReplacedDate' | 'intervalDays' | 'reminderLeadDays' | 'snoozedUntil'>,
  today: string
): Date {
  let trigger: Date;
  if (isSnoozed(item, today)) {
    trigger = startOfDay(parseISO(item.snoozedUntil as string));
  } else {
    trigger = getDueDate(item);
    trigger.setDate(trigger.getDate() - item.reminderLeadDays);
  }
  trigger.setHours(9, 0, 0, 0);
  return trigger;
}
