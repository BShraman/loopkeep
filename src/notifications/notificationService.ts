import type * as NotificationsModule from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Item } from '../types/Item';
import { formatDueDate, todayISO } from '../utils/dateCalculations';
import { needsRestock, reminderTriggerDate, snoozeDate } from '../utils/itemExtras';
import { isExpoGo } from '../utils/appEnv';
import {
  clearNotificationId,
  getAllItems,
  getItemById,
  getNotificationId,
  setNotificationId,
  setSnooze,
} from '../db/itemsRepository';

const REMINDER_CATEGORY = 'reminder';
// Action buttons on a reminder: "snooze-<days>".
const SNOOZE_ACTIONS: { days: number; title: string }[] = [
  { days: 1, title: 'Tomorrow' },
  { days: 3, title: 'In 3 days' },
];

// expo-notifications can't even be imported in Expo Go on Android (SDK 53+):
// loading the module registers a push-token listener that throws "Android Push
// notifications ... removed from Expo Go" and the app fails to start. So it is
// required lazily, and never in Expo Go. Dev and store builds load it normally.
let notificationsModule: typeof NotificationsModule | null = null;

function getNotifications(): typeof NotificationsModule | null {
  // Scheduling isn't available on web and throws, which would abort callers.
  if (isExpoGo || Platform.OS === 'web') return null;
  if (!notificationsModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications: typeof NotificationsModule = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    // Snooze buttons on reminders. Fire-and-forget: a failure only hides the buttons.
    Notifications.setNotificationCategoryAsync(
      REMINDER_CATEGORY,
      SNOOZE_ACTIONS.map((a) => ({
        identifier: `snooze-${a.days}`,
        buttonTitle: a.title,
        options: { opensAppToForeground: true },
      }))
    ).catch(() => {});
    notificationsModule = Notifications;
  }
  return notificationsModule;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  // Notifications don't work in Expo Go (Android, SDK 53+) — use a dev build.
  const Notifications = getNotifications();
  if (!Notifications) return false;
  if (!Device.isDevice) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Maintenance reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelReminderForItem(itemId: string): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  const notificationId = await getNotificationId(itemId);
  if (notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // already fired or cancelled — nothing to do
    }
    await clearNotificationId(itemId);
  }
}

/**
 * Cancel any existing reminder for this item and schedule a new one at
 * (dueDate - reminderLeadDays) at 9:00 AM local time. Skips scheduling if
 * reminders are disabled or the reminder time is already in the past.
 */
export async function rescheduleReminderForItem(item: Item): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await cancelReminderForItem(item.id);

  if (!item.reminderEnabled) return;

  // On the snooze day while snoozed, otherwise a few days before it's due.
  const triggerDate = reminderTriggerDate(item, todayISO());
  if (triggerDate.getTime() <= Date.now()) return;

  const spares = needsRestock(item) ? ' No spares left, so reorder soon.' : '';
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${item.name} due soon`,
      body: `Due on ${formatDueDate(item)}. Open Loopkeep to mark it replaced.${spares}`,
      data: { itemId: item.id },
      categoryIdentifier: REMINDER_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: 'reminders',
    },
  });

  await setNotificationId(item.id, notificationId);
}

/**
 * Cancel every scheduled reminder and re-create them for the items currently
 * in the database. Used after a backup restore, where the imported items have
 * no device notifications yet (and any old ones belonged to the wiped data).
 * Reminder scheduling is a best-effort, device-only concern — failures here
 * (e.g. web, or permissions denied) must not fail the surrounding restore, so
 * each item is scheduled independently and errors are swallowed.
 */
export async function rescheduleAllReminders(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Not supported on this platform (e.g. web) — nothing to cancel.
    return;
  }

  const items = await getAllItems();
  for (const item of items) {
    try {
      await rescheduleReminderForItem(item);
    } catch {
      // Skip this item's reminder; the item data itself is already saved.
    }
  }
}

/** Push an item's reminder to `days` from today, or clear the snooze with null. */
export async function snoozeItem(itemId: string, days: number | null): Promise<void> {
  await setSnooze(itemId, days == null ? null : snoozeDate(new Date(), days));
  const item = await getItemById(itemId);
  if (item) await rescheduleReminderForItem(item);
}

/**
 * Handle taps on a reminder's snooze buttons, including the one that launched
 * the app. Returns a cleanup function; a no-op where notifications aren't
 * available (Expo Go, web).
 */
export function startReminderActionHandling(): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};

  const handle = async (response: NotificationsModule.NotificationResponse) => {
    const match = /^snooze-(\d+)$/.exec(response.actionIdentifier);
    const itemId = response.notification.request.content.data?.itemId;
    if (!match || typeof itemId !== 'string') return;
    await snoozeItem(itemId, Number(match[1]));
    await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
    await Notifications.clearLastNotificationResponseAsync().catch(() => {});
  };

  const subscription = Notifications.addNotificationResponseReceivedListener((r) => {
    handle(r).catch(() => {});
  });
  Notifications.getLastNotificationResponseAsync()
    .then((r) => (r ? handle(r) : undefined))
    .catch(() => {});
  return () => subscription.remove();
}
