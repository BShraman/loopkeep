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
  reminderEnabled: boolean;
  reminderLeadDays: number;
  isCustom: boolean;
  createdAt: string;
}

export interface ReplacementHistory {
  id: string;
  itemId: string;
  replacedDate: string;
}
