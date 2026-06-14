import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let lastWrittenCount = -1;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const BADGE_DEBOUNCE_MS = 300;
const BADGE_NOTIF_ID    = 'mm_badge_sync';

// ─── Init ─────────────────────────────────────────────────────────────────────
export const initBadgeService = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    await setupAndroidChannels();
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────
export const updateAppIconBadge = (count: number): void => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => writeBadge(count), BADGE_DEBOUNCE_MS);
};

export const updateAppIconBadgeImmediate = async (count: number): Promise<void> => {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  await writeBadge(count);
};

export const clearAppIconBadge = async (): Promise<void> => {
  await updateAppIconBadgeImmediate(0);
};

export const formatBadgeCount = (count: number): string => {
  if (count <= 0)  return '';
  if (count <= 99) return String(count);
  return '99+';
};

// ─── Internal ─────────────────────────────────────────────────────────────────
const writeBadge = async (count: number): Promise<void> => {
  if (count === lastWrittenCount) return;
  lastWrittenCount = count;
  const safeCount = Math.max(0, count);
  try {
    if (Platform.OS === 'ios') {
      await writeIosBadge(safeCount);
    } else if (Platform.OS === 'android') {
      await writeAndroidBadge(safeCount);
    }
  } catch (e) {
    console.warn('[BadgeService] Failed to write badge:', e);
  }
};

const writeIosBadge = async (count: number): Promise<void> => {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return;
  await Notifications.setBadgeCountAsync(count);
};

const writeAndroidBadge = async (count: number): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(BADGE_NOTIF_ID).catch(() => {});
  await dismissBadgeNotifications();

  if (count === 0) {
    await Notifications.setBadgeCountAsync(0).catch(() => {});
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: BADGE_NOTIF_ID,
    content: {
      title:     '',
      body:      '',
      badge:     count,
      data:      { type: 'badge_sync', count },
      sound:     undefined,
    },
    trigger: null,
  });

  await Notifications.setBadgeCountAsync(count).catch(() => {});
};

// ─── Android Channels ─────────────────────────────────────────────────────────
// Each channel controls sound, vibration, and importance independently.
// Popular apps use separate channels per notification type — this is the correct pattern.
const setupAndroidChannels = async (): Promise<void> => {
  // Messages — high importance, vibration, purple light
  await Notifications.setNotificationChannelAsync('messages', {
    name:             'Messages',
    importance:       Notifications.AndroidImportance.HIGH,
    sound:            'default',
    enableVibrate:    true,
    vibrationPattern: [0, 250, 250, 250],
    enableLights:     true,
    lightColor:       '#6D4AFF',
    showBadge:        true,
    description:      'New message notifications from your connections',
  });

  // Social — connection requests and accepts
  await Notifications.setNotificationChannelAsync('social', {
    name:             'Social Activity',
    importance:       Notifications.AndroidImportance.DEFAULT,
    sound:            'default',
    enableVibrate:    true,
    vibrationPattern: [0, 150],
    enableLights:     true,
    lightColor:       '#6D4AFF',
    showBadge:        true,
    description:      'Connection requests and social activity',
  });

  // Daily motivational broadcasts
  await Notifications.setNotificationChannelAsync('daily', {
    name:             'Daily Motivation',
    importance:       Notifications.AndroidImportance.DEFAULT,
    sound:            'default',
    enableVibrate:    false,
    enableLights:     true,
    lightColor:       '#6D4AFF',
    showBadge:        false,
    description:      'Daily motivational messages from the MindMates team',
  });

  // Badge sync — completely silent, invisible to users
  await Notifications.setNotificationChannelAsync('badge_sync_silent', {
    name:          'Badge Sync',
    importance:    Notifications.AndroidImportance.MIN,
    enableVibrate: false,
    enableLights:  false,
    showBadge:     true,
    sound:         null,
    description:   'Internal badge sync. Not visible to users.',
  });
};

const dismissBadgeNotifications = async (): Promise<void> => {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const badgeNotifs = presented.filter(
      n => n.request.content.data?.type === 'badge_sync'
    );
    await Promise.all(
      badgeNotifs.map(n => Notifications.dismissNotificationAsync(n.request.identifier))
    );
  } catch (_) {}
};

export const ensureNotificationPermission = async (): Promise<boolean> => {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: requested } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return requested === 'granted';
};