import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Item } from '../types/Item';
import { getDueDate, formatDueDate } from '../utils/dateCalculations';
import { isExpoGo } from '../utils/appEnv';
import {
  clearNotificationId,
  getAllItems,
  getNotificationId,
  setNotificationId,
} from '../db/itemsRepository';

// expo-notifications is unavailable in Expo Go (Android, SDK 53+); registering
// the handler there triggers its "removed from Expo Go" error. Skip it in Expo
// Go — a dev/standalone build sets it up normally.
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  // Notifications don't work in Expo Go (Android, SDK 53+) — use a dev build.
  if (isExpoGo) return false;
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
  if (isExpoGo) return;
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
  if (isExpoGo) return;
  await cancelReminderForItem(item.id);

  if (!item.reminderEnabled) return;

  const triggerDate = getDueDate(item);
  triggerDate.setDate(triggerDate.getDate() - item.reminderLeadDays);
  triggerDate.setHours(9, 0, 0, 0);

  if (triggerDate.getTime() <= Date.now()) return;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${item.name} due soon`,
      body: `Due on ${formatDueDate(item)}. Open Loopkeep to mark it replaced.`,
      data: { itemId: item.id },
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
  if (isExpoGo) return;
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
