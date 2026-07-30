import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getAllHistory, getAllItems, replaceAllData } from './itemsRepository';
import { rescheduleAllReminders } from '../notifications/notificationService';
import { CATEGORIES, Category, Item, ReplacementHistory } from '../types/Item';

// Bump when the backup shape changes in a way older apps can't read.
export const BACKUP_APP_ID = 'loopkeep';
export const BACKUP_VERSION = 1;

export interface BackupData {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  items: Item[];
  history: ReplacementHistory[];
}

/** Read the full user dataset out of the database into a plain object. */
export async function buildBackup(): Promise<BackupData> {
  const [items, history] = await Promise.all([getAllItems(), getAllHistory()]);
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items,
    history,
  };
}

export function serializeBackup(data: BackupData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Parse and validate a backup file's text. Throws a user-readable Error if the
 * file isn't a Loopkeep backup we can restore — the caller surfaces the message.
 */
export function parseBackup(json: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error("This file isn't a Loopkeep backup.");
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.app !== BACKUP_APP_ID) {
    throw new Error("This file isn't a Loopkeep backup.");
  }
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of Loopkeep. Please update the app.');
  }
  if (!Array.isArray(obj.items)) {
    throw new Error('This backup is missing its item list.');
  }

  const items = obj.items.map(validateItem);
  const rawHistory = Array.isArray(obj.history) ? obj.history : [];
  const history = rawHistory.map(validateHistory);

  return { app: BACKUP_APP_ID, version: obj.version, exportedAt: String(obj.exportedAt ?? ''), items, history };
}

function validateItem(raw: unknown, index: number): Item {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Item #${index + 1} in the backup is malformed.`);
  }
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

  if (!str(r.id) || !str(r.name)) {
    throw new Error(`Item #${index + 1} in the backup is missing an id or name.`);
  }
  const category = (CATEGORIES as string[]).includes(str(r.category))
    ? (r.category as Category)
    : 'Other';

  return {
    id: str(r.id),
    name: str(r.name),
    category,
    lastReplacedDate: str(r.lastReplacedDate),
    intervalDays: num(r.intervalDays, 90),
    notes: typeof r.notes === 'string' ? r.notes : undefined,
    reminderEnabled: r.reminderEnabled !== false,
    reminderLeadDays: num(r.reminderLeadDays, 5),
    isCustom: r.isCustom === true,
    createdAt: str(r.createdAt) || new Date().toISOString(),
  };
}

function validateHistory(raw: unknown, index: number): ReplacementHistory {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`History entry #${index + 1} in the backup is malformed.`);
  }
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r.id === 'string' ? r.id : `${Date.now()}-${index}`,
    itemId: typeof r.itemId === 'string' ? r.itemId : '',
    replacedDate: typeof r.replacedDate === 'string' ? r.replacedDate : '',
  };
}

/** Overwrite the device's data with a parsed backup, then refresh reminders. */
export async function restoreBackup(data: BackupData): Promise<void> {
  await replaceAllData(data.items, data.history);
  await rescheduleAllReminders();
}

function backupFileName(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `loopkeep-backup-${date}.json`;
}

export interface ExportResult {
  fileName: string;
  itemCount: number;
}

/**
 * Export the whole dataset as a JSON file and hand it to the OS share sheet
 * (native) or trigger a browser download (web). One tap for the user.
 */
export async function exportBackup(): Promise<ExportResult> {
  const data = await buildBackup();
  const json = serializeBackup(data);
  const fileName = backupFileName();

  if (Platform.OS === 'web') {
    downloadOnWeb(json, fileName);
    return { fileName, itemCount: data.items.length };
  }

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Loopkeep backup',
      UTI: 'public.json',
    });
  }
  return { fileName, itemCount: data.items.length };
}

export interface ImportResult {
  itemCount: number;
}

/**
 * Let the user pick a backup file, validate it, and replace their data with it.
 * Returns null if the user cancelled the picker. Throws a user-readable Error
 * for an invalid/unreadable file.
 */
export async function importBackup(): Promise<ImportResult | null> {
  let json: string | null;

  if (Platform.OS === 'web') {
    json = await pickTextOnWeb();
  } else {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return null;
    json = await new File(result.assets[0].uri).text();
  }

  if (json === null) return null; // cancelled

  const data = parseBackup(json);
  await restoreBackup(data);
  return { itemCount: data.items.length };
}

// --- Web-only helpers (guarded by Platform.OS === 'web') -------------------

function downloadOnWeb(json: string, fileName: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function pickTextOnWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    // If the user dismisses the dialog, onchange never fires; that's fine —
    // the promise simply stays pending and the UI returns to idle on unmount.
    input.click();
  });
}
