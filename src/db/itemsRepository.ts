import { getDatabase } from './database';
import { Category, Item, ReplacementHistory } from '../types/Item';

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ItemRow {
  id: string;
  name: string;
  category: string;
  lastReplacedDate: string;
  intervalDays: number;
  notes: string | null;
  reminderEnabled: number;
  reminderLeadDays: number;
  isCustom: number;
  createdAt: string;
}

function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Category,
    lastReplacedDate: row.lastReplacedDate,
    intervalDays: row.intervalDays,
    notes: row.notes ?? undefined,
    reminderEnabled: row.reminderEnabled === 1,
    reminderLeadDays: row.reminderLeadDays,
    isCustom: row.isCustom === 1,
    createdAt: row.createdAt,
  };
}

export async function getAllItems(): Promise<Item[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ItemRow>('SELECT * FROM items ORDER BY name');
  return rows.map(rowToItem);
}

export async function getItemById(id: string): Promise<Item | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ItemRow>('SELECT * FROM items WHERE id = ?', id);
  return row ? rowToItem(row) : null;
}

export async function insertItem(item: Item): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO items (id, name, category, lastReplacedDate, intervalDays, notes,
       reminderEnabled, reminderLeadDays, isCustom, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.name,
    item.category,
    item.lastReplacedDate,
    item.intervalDays,
    item.notes ?? null,
    item.reminderEnabled ? 1 : 0,
    item.reminderLeadDays,
    item.isCustom ? 1 : 0,
    item.createdAt
  );
}

export async function updateItem(item: Item): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE items SET name = ?, category = ?, lastReplacedDate = ?, intervalDays = ?,
       notes = ?, reminderEnabled = ?, reminderLeadDays = ? WHERE id = ?`,
    item.name,
    item.category,
    item.lastReplacedDate,
    item.intervalDays,
    item.notes ?? null,
    item.reminderEnabled ? 1 : 0,
    item.reminderLeadDays,
    item.id
  );
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM items WHERE id = ?', id);
}

export async function markReplaced(itemId: string, replacedDate: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO replacement_history (id, itemId, replacedDate) VALUES (?, ?, ?)',
      generateId(),
      itemId,
      replacedDate
    );
    await db.runAsync('UPDATE items SET lastReplacedDate = ? WHERE id = ?', replacedDate, itemId);
  });
}

export async function getHistoryForItem(itemId: string): Promise<ReplacementHistory[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReplacementHistory>(
    'SELECT * FROM replacement_history WHERE itemId = ? ORDER BY replacedDate DESC',
    itemId
  );
}

export async function getAllHistory(): Promise<ReplacementHistory[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReplacementHistory>(
    'SELECT * FROM replacement_history ORDER BY replacedDate DESC'
  );
}

/**
 * Replace ALL item + history data in one transaction — used when restoring a
 * backup onto a device. Deleting the items rows cascades (ON DELETE CASCADE)
 * to replacement_history and notification_ids, so the device starts clean
 * before the imported rows go in. History rows referencing an unknown item
 * are skipped to keep the foreign key intact.
 */
export async function replaceAllData(
  items: Item[],
  history: ReplacementHistory[]
): Promise<void> {
  const db = await getDatabase();
  const itemIds = new Set(items.map((i) => i.id));
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM items');
    for (const item of items) {
      await db.runAsync(
        `INSERT INTO items (id, name, category, lastReplacedDate, intervalDays, notes,
           reminderEnabled, reminderLeadDays, isCustom, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.name,
        item.category,
        item.lastReplacedDate,
        item.intervalDays,
        item.notes ?? null,
        item.reminderEnabled ? 1 : 0,
        item.reminderLeadDays,
        item.isCustom ? 1 : 0,
        item.createdAt
      );
    }
    for (const h of history) {
      if (!itemIds.has(h.itemId)) continue;
      await db.runAsync(
        'INSERT INTO replacement_history (id, itemId, replacedDate) VALUES (?, ?, ?)',
        h.id,
        h.itemId,
        h.replacedDate
      );
    }
  });
}

export async function getNotificationId(itemId: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ notificationId: string }>(
    'SELECT notificationId FROM notification_ids WHERE itemId = ?',
    itemId
  );
  return row?.notificationId ?? null;
}

export async function setNotificationId(itemId: string, notificationId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO notification_ids (itemId, notificationId) VALUES (?, ?)',
    itemId,
    notificationId
  );
}

export async function clearNotificationId(itemId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM notification_ids WHERE itemId = ?', itemId);
}
