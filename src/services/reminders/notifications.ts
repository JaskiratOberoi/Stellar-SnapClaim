/**
 * Local reminder notifications through expo-notifications.
 *
 * Only Android and iOS can schedule them. On web and in the Electron shell the
 * functions resolve to null so callers can carry on without a notification.
 */

import { Platform } from 'react-native';

import type { Task } from '@/services/store/types';

const SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios';
const CHANNEL_ID = 'reminders';

type NotificationsModule = typeof import('expo-notifications');

let modulePromise: Promise<NotificationsModule | null> | null = null;

async function loadModule(): Promise<NotificationsModule | null> {
  if (!SUPPORTED) return null;
  if (!modulePromise) {
    modulePromise = (async () => {
      try {
        const Notifications = await import('expo-notifications');
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: 'Reminders',
            importance: Notifications.AndroidImportance.HIGH,
          });
        }
        return Notifications;
      } catch {
        return null;
      }
    })();
  }
  return modulePromise;
}

export async function ensureReminderPermission(): Promise<boolean> {
  const Notifications = await loadModule();
  if (!Notifications) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/** Schedule a notification for the task's remind time. Resolves with its id, or null if not scheduled. */
export async function scheduleReminder(task: Task): Promise<string | null> {
  if (!task.remindAt || task.remindAt <= Date.now()) return null;
  const Notifications = await loadModule();
  if (!Notifications) return null;
  if (!(await ensureReminderPermission())) return null;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: task.title,
        body: task.notes || 'Reminder from Assistant',
        data: { taskId: task.id },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(task.remindAt),
      },
    });
  } catch {
    return null;
  }
}

export async function cancelReminder(notificationId: string | undefined): Promise<void> {
  if (!notificationId) return;
  const Notifications = await loadModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already fired or never existed.
  }
}
