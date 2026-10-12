import type { SQLiteDatabase } from 'expo-sqlite';
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
  barcode: string | null;
  sparesCount: number | null;
  reorderUrl: string | null;
  snoozedUntil: string | null;
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
    barcode: row.barcode ?? undefined,
    spares: row.sparesCount ?? undefined,
    reorderUrl: row.reorderUrl ?? undefined,
    snoozedUntil: row.snoozedUntil ?? undefined,
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

async function insertItemRow(db: SQLiteDatabase, item: Item): Promise<void> {
  await db.runAsync(
    `INSERT INTO items (id, name, category, lastReplacedDate, intervalDays, notes,
       reminderEnabled, reminderLeadDays, isCustom, createdAt, barcode,
       sparesCount, reorderUrl, snoozedUntil)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.name,
    item.category,
    item.lastReplacedDate,
    item.intervalDays,
    item.notes ?? null,
    item.reminderEnabled ? 1 : 0,
    item.reminderLeadDays,
    item.isCustom ? 1 : 0,
    item.createdAt,
    item.barcode ?? null,
    item.spares ?? null,
    item.reorderUrl ?? null,
    item.snoozedUntil ?? null
  );
}

export async function insertItem(item: Item): Promise<void> {
  const db = await getDatabase();
  await insertItemRow(db, item);
}

export async function updateItem(item: Item): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE items SET name = ?, category = ?, lastReplacedDate = ?, intervalDays = ?,
       notes = ?, reminderEnabled = ?, reminderLeadDays = ?, barcode = ?,
       sparesCount = ?, reorderUrl = ?, snoozedUntil = ? WHERE id = ?`,
    item.name,
    item.category,
    item.lastReplacedDate,
    item.intervalDays,
    item.notes ?? null,
    item.reminderEnabled ? 1 : 0,
    item.reminderLeadDays,
    item.barcode ?? null,
    item.spares ?? null,
    item.reorderUrl ?? null,
    item.snoozedUntil ?? null,
    item.id
  );
}

/** Set spares on hand (null stops tracking spares for this item). */
export async function setSpares(itemId: string, spares: number | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE items SET sparesCount = ? WHERE id = ?',
    spares == null ? null : Math.max(0, Math.round(spares)),
    itemId
  );
}

/** Push the item's reminder to `until` (yyyy-MM-dd), or clear the snooze with null. */
export async function setSnooze(itemId: string, until: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE items SET snoozedUntil = ? WHERE id = ?', until, itemId);
}

export async function getItemByBarcode(barcode: string): Promise<Item | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ItemRow>('SELECT * FROM items WHERE barcode = ?', barcode);
  return row ? rowToItem(row) : null;
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM items WHERE id = ?', id);
}

interface HistoryRow {
  id: string;
  itemId: string;
  replacedDate: string;
  priceCents: number | null;
  laborCents: number | null;
  doneBy: string | null;
  note: string | null;
}

function rowToHistory(row: HistoryRow): ReplacementHistory {
  return {
    id: row.id,
    itemId: row.itemId,
    replacedDate: row.replacedDate,
    price: row.priceCents ?? undefined,
    labor: row.laborCents ?? undefined,
    doneBy: row.doneBy ?? undefined,
    note: row.note ?? undefined,
  };
}

/** Record a replacement and return the new history row's id. */
export async function markReplaced(
  itemId: string,
  replacedDate: string,
  priceCents?: number
): Promise<string> {
  const db = await getDatabase();
  const historyId = generateId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO replacement_history (id, itemId, replacedDate, priceCents) VALUES (?, ?, ?, ?)',
      historyId,
      itemId,
      replacedDate,
      priceCents ?? null
    );
    // Replacing uses one spare (if spares are tracked) and ends any snooze.
    await db.runAsync(
      `UPDATE items SET lastReplacedDate = ?, snoozedUntil = NULL,
         sparesCount = CASE WHEN sparesCount > 0 THEN sparesCount - 1 ELSE sparesCount END
       WHERE id = ?`,
      replacedDate,
      itemId
    );
  });
  return historyId;
}

/**
 * Record a purchase without moving the item's lastReplacedDate — used when an
 * item is first added with a price, so that first purchase shows in its trend.
 */
export async function addHistoryEntry(
  itemId: string,
  replacedDate: string,
  priceCents?: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO replacement_history (id, itemId, replacedDate, priceCents) VALUES (?, ?, ?, ?)',
    generateId(),
    itemId,
    replacedDate,
    priceCents ?? null
  );
}

export interface ReplacementDetails {
  price: number | null; // cents
  labor: number | null; // cents
  doneBy: string | null;
  note: string | null;
}

/** Set price, contractor cost, who did it and notes on one history row (null clears). */
export async function updateHistoryDetails(
  historyId: string,
  details: ReplacementDetails
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE replacement_history SET priceCents = ?, laborCents = ?, doneBy = ?, note = ? WHERE id = ?',
    details.price,
    details.labor,
    details.doneBy?.trim() || null,
    details.note?.trim() || null,
    historyId
  );
}

/** Set, change or clear (null) the price on one history row. */
export async function setHistoryPrice(historyId: string, priceCents: number | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE replacement_history SET priceCents = ? WHERE id = ?',
    priceCents,
    historyId
  );
}

/** Most recent price paid for an item, or null if none was ever recorded. */
export async function getLastPrice(itemId: string): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ priceCents: number }>(
    `SELECT priceCents FROM replacement_history
     WHERE itemId = ? AND priceCents IS NOT NULL
     ORDER BY replacedDate DESC, rowid DESC LIMIT 1`,
    itemId
  );
  return row?.priceCents ?? null;
}

/** The item's most recent replacement row (priced or not), or null if it has none. */
export async function getLatestHistoryEntry(itemId: string): Promise<ReplacementHistory | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<HistoryRow>(
    `SELECT * FROM replacement_history WHERE itemId = ?
     ORDER BY replacedDate DESC, rowid DESC LIMIT 1`,
    itemId
  );
  return row ? rowToHistory(row) : null;
}

export async function getHistoryForItem(itemId: string): Promise<ReplacementHistory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<HistoryRow>(
    'SELECT * FROM replacement_history WHERE itemId = ? ORDER BY replacedDate DESC, rowid DESC',
    itemId
  );
  return rows.map(rowToHistory);
}

export async function getAllHistory(): Promise<ReplacementHistory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<HistoryRow>(
    'SELECT * FROM replacement_history ORDER BY replacedDate DESC, rowid DESC'
  );
  return rows.map(rowToHistory);
}

/**
 * Every history row with a cost (a price, a contractor cost or both), oldest
 * first — feeds the spending trend and the "last paid" lines.
 */
export async function getAllPricedHistory(): Promise<ReplacementHistory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<HistoryRow>(
    `SELECT * FROM replacement_history
     WHERE priceCents IS NOT NULL OR laborCents IS NOT NULL
     ORDER BY replacedDate ASC, rowid ASC`
  );
  return rows.map(rowToHistory);
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
      await insertItemRow(db, item);
    }
    for (const h of history) {
      if (!itemIds.has(h.itemId)) continue;
      await db.runAsync(
        `INSERT INTO replacement_history (id, itemId, replacedDate, priceCents, laborCents, doneBy, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        h.id,
        h.itemId,
        h.replacedDate,
        h.price ?? null,
        h.labor ?? null,
        h.doneBy ?? null,
        h.note ?? null
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
