import { getSetting, setSetting } from './database';
import { generateId, insertItem } from './itemsRepository';
import { Category, Item } from '../types/Item';
import { todayISO } from '../utils/dateCalculations';

const SEED_FLAG_KEY = 'seeded';

const SEED_ITEMS: { name: string; category: Category; intervalDays: number }[] = [
  { name: 'AC / HVAC Filter', category: 'HVAC', intervalDays: 90 },
  { name: 'Furnace Filter', category: 'HVAC', intervalDays: 90 },
  { name: 'Refrigerator Water Filter', category: 'Kitchen', intervalDays: 180 },
  { name: 'Under-Sink Water Filter', category: 'Kitchen', intervalDays: 180 },
  { name: 'Smoke Detector Battery', category: 'Safety', intervalDays: 365 },
  { name: 'Carbon Monoxide Detector Battery', category: 'Safety', intervalDays: 365 },
  { name: 'Water Softener Salt', category: 'Plumbing', intervalDays: 60 },
  { name: 'Dryer Vent Cleaning', category: 'Other', intervalDays: 365 },
  { name: 'Water Heater Flush', category: 'Plumbing', intervalDays: 365 },
  { name: 'Shower Head Descale', category: 'Plumbing', intervalDays: 180 },
];

export async function seedIfNeeded(): Promise<void> {
  const seeded = await getSetting(SEED_FLAG_KEY);
  if (seeded === 'true') return;

  const now = new Date().toISOString();
  const today = todayISO();

  for (const seed of SEED_ITEMS) {
    const item: Item = {
      id: generateId(),
      name: seed.name,
      category: seed.category,
      lastReplacedDate: today,
      intervalDays: seed.intervalDays,
      reminderEnabled: true,
      reminderLeadDays: 5,
      isCustom: false,
      createdAt: now,
    };
    await insertItem(item);
  }

  await setSetting(SEED_FLAG_KEY, 'true');
}
