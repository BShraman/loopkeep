import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Cache the in-flight promise, not just the resolved handle, so concurrent
  // first-callers (e.g. app bootstrap and the theme provider) share one open
  // instead of racing to open the database twice.
  if (!dbPromise) {
    dbPromise = (async () => {
      const database = await SQLite.openDatabaseAsync('loopkeep.db');
      await migrate(database);
      return database;
    })();
  }
  return dbPromise;
}

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      lastReplacedDate TEXT NOT NULL,
      intervalDays INTEGER NOT NULL,
      notes TEXT,
      reminderEnabled INTEGER NOT NULL DEFAULT 1,
      reminderLeadDays INTEGER NOT NULL DEFAULT 5,
      isCustom INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS replacement_history (
      id TEXT PRIMARY KEY,
      itemId TEXT NOT NULL,
      replacedDate TEXT NOT NULL,
      FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_ids (
      itemId TEXT PRIMARY KEY,
      notificationId TEXT NOT NULL,
      FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Added after 1.0: product barcode for scan-to-match. Older installs get the
  // column added once; CREATE TABLE above stays as shipped.
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(items)');
  if (!columns.some((c) => c.name === 'barcode')) {
    await database.execAsync('ALTER TABLE items ADD COLUMN barcode TEXT');
  }
  await database.execAsync('CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode)');

  // Added with price history: what was paid for each replacement, in whole
  // cents (null when the user skipped it).
  await addColumnIfMissing(database, 'replacement_history', 'priceCents', 'INTEGER');

  // Added with spares, snooze and replacement notes.
  await addColumnIfMissing(database, 'items', 'sparesCount', 'INTEGER'); // null = not tracking
  await addColumnIfMissing(database, 'items', 'reorderUrl', 'TEXT');
  await addColumnIfMissing(database, 'items', 'snoozedUntil', 'TEXT');
  await addColumnIfMissing(database, 'replacement_history', 'laborCents', 'INTEGER');
  await addColumnIfMissing(database, 'replacement_history', 'doneBy', 'TEXT');
  await addColumnIfMissing(database, 'replacement_history', 'note', 'TEXT');
  await database.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_history_date ON replacement_history(replacedDate)'
  );
}

/** Add a column to an existing table once; CREATE TABLE above stays as shipped. */
async function addColumnIfMissing(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  type: string
): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((c) => c.name === column)) {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key,
    value
  );
}
