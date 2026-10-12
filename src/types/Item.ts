export type Category = 'HVAC' | 'Kitchen' | 'Safety' | 'Plumbing' | 'Other';

export const CATEGORIES: Category[] = ['HVAC', 'Kitchen', 'Safety', 'Plumbing', 'Other'];

export type ItemStatus = 'overdue' | 'dueSoon' | 'ok';

export interface Item {
  id: string;
  name: string;
  category: Category;
  lastReplacedDate: string; // ISO date (yyyy-MM-dd)
  intervalDays: number;
  notes?: string;
  barcode?: string; // normalized, see utils/barcode.ts
  spares?: number; // spares on hand; undefined = not tracking spares
  reorderUrl?: string; // where to buy more; falls back to a shopping search
  snoozedUntil?: string; // ISO date (yyyy-MM-dd); reminder is pushed to this day
  reminderEnabled: boolean;
  reminderLeadDays: number;
  isCustom: boolean;
  createdAt: string;
}

export interface ReplacementHistory {
  id: string;
  itemId: string;
  replacedDate: string;
  price?: number; // whole cents, in the app currency; absent when not recorded
  labor?: number; // contractor / labor cost in whole cents; absent when none
  doneBy?: string; // who did it, e.g. "Me" or a contractor's name
  note?: string; // brand used, part number, anything worth remembering
}
