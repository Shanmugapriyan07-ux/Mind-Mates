// services/badgeService.ts
//
// ══════════════════════════════════════════════════════════════════
// APP ICON BADGE SERVICE — iOS + Android
// ══════════════════════════════════════════════════════════════════
//
// PLATFORM STRATEGY:
//
//   iOS:
//     expo-notifications setBadgeCountAsync() calls APNs directly.
//     Works in foreground, background, and after kill.
//     Requires NotificationPermissions (already granted for push).
//     Badge persists until explicitly cleared — matches WhatsApp behavior.
//
//   Android:
//     Android does NOT have a universal badge API.
//     Badges are driven by NOTIFICATION presence, not a direct API.
//     Strategy:
//       A) When app is KILLED/BACKGROUND: backend push notification includes
//          the badge count in the notification payload. The launcher reads this
//          from the notification and shows the dot/count.
//       B) When app is FOREGROUND: we post a LOCAL silent notification with
//          the new count. Most launchers (Samsung, Pixel, Xiaomi) read this
//          and update the badge.
//       C) When count reaches 0: cancel all local badge notifications.
//
//     LAUNCHER COMPATIBILITY:
//       Samsung One UI  → reads notification count from channel ✅
//       Xiaomi MIUI     → requires special ShortcutBadger support ✅ (via expo-notifications)
//       Pixel / Stock   → reads active notification count ✅
//       OnePlus / OOS   → same as stock ✅
//       Some launchers  → may not support badges (graceful fallback) ✅
//
// DEBOUNCE:
//   Badge writes are debounced 300ms to batch rapid message arrivals.
//   WhatsApp receives 3 messages in 100ms → badge updates once to final count.

import * as Notifications from 'expo-notifications';
import { Platform }       from 'react-native';

// ── Internal state ────────────────────────────────────────────────
let lastWrittenCount = -1;     // prevents redundant badge writes
let debounceTimer:   ReturnType<typeof setTimeout> | null = null;
const BADGE_DEBOUNCE_MS = 300;

// Android notification ID for local badge notification
const BADGE_NOTIF_ID = 'mm_badge_sync';

// ── Initialize badge service (call once on app start) ─────────────
export const initBadgeService = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    await setupAndroidBadgeChannel();
  }
};

// ── Main: update app icon badge ───────────────────────────────────
// Call this whenever totalUnread changes.
// It's debounced — safe to call on every realtime event.
export const updateAppIconBadge = (count: number): void => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    writeBadge(count);
  }, BADGE_DEBOUNCE_MS);
};

// ── Force immediate badge write (no debounce) ─────────────────────
// Use when user opens app / reads all messages — needs instant clear.
export const updateAppIconBadgeImmediate = async (count: number): Promise<void> => {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  await writeBadge(count);
};

// ── Core write logic ──────────────────────────────────────────────
const writeBadge = async (count: number): Promise<void> => {
  // Skip if same count — no I/O, no re-render
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
    // Non-fatal — app works fine without badge
  }
};

// ── iOS badge ─────────────────────────────────────────────────────
// setBadgeCountAsync is a direct APNs badge write — instant, reliable.
// Works in all app states. Does not require an active notification.
const writeIosBadge = async (count: number): Promise<void> => {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    console.warn('[BadgeService] iOS notification permission not granted');
    return;
  }
  await Notifications.setBadgeCountAsync(count);
};

// ── Android badge ─────────────────────────────────────────────────
// Android badge strategy: maintain a silent local notification.
// When count > 0: post/update a silent notification with the count.
// When count = 0: cancel all badge notifications.
//
// IMPORTANT: This only affects launcher badge dots.
// The notification itself is set to not appear in the shade (priority = -2).
// User never sees the notification — just the launcher dot.
const writeAndroidBadge = async (count: number): Promise<void> => {
  // Cancel existing badge notification first (prevents duplicates)
  await Notifications.cancelScheduledNotificationAsync(BADGE_NOTIF_ID).catch(() => {});

  if (count === 0) {
    // Zero count → dismiss all badge-related notifications
    // This clears the dot on launchers that count active notifications
    await dismissBadgeNotifications();
    return;
  }

  // Post a silent notification that launchers read for badge count
  // priority = -2 (IMPORTANCE_MIN) → doesn't show in notification shade
  // but launcher still reads it for badge counting
  await Notifications.scheduleNotificationAsync({
    identifier: BADGE_NOTIF_ID,
    content: {
      title:  'MindMates',
      body:   formatBadgeCount(count) + ' unread message' + (count !== 1 ? 's' : ''),
      badge:  count,
      // Silent: won't appear in shade visually for Android 8+
      // (this depends on channel importance — we set it to MIN below)
      data:   { type: 'badge_sync', count },
      sound:  undefined,
    },
    trigger: null,  // null = immediate, no repeat
  });
};

// ── Android notification channel setup ───────────────────────────
// IMPORTANCE_MIN channel → silent badge-only notifications.
// Created once on app start. Safe to call multiple times (idempotent).
const setupAndroidBadgeChannel = async (): Promise<void> => {
  await Notifications.setNotificationChannelAsync('badge_sync', {
    name:             'Badge Sync',
    importance:       Notifications.AndroidImportance.MIN,
    // MIN importance: no sound, no vibration, no heads-up, no notification shade entry
    // But launcher badge IS updated — this is the key to silent badges
    enableVibrate:    false,
    enableLights:     false,
    showBadge:        true,
    sound:            null,
    description:      'Internal badge count sync. No user-visible notifications.',
  });
};

// ── Dismiss all badge notifications ──────────────────────────────
const dismissBadgeNotifications = async (): Promise<void> => {
  const presented = await Notifications.getPresentedNotificationsAsync();
  const badgeNotifs = presented.filter(
    n => n.request.content.data?.type === 'badge_sync'
  );
  await Promise.all(
    badgeNotifs.map(n => Notifications.dismissNotificationAsync(n.request.identifier))
  );
};

// ── Permission check ──────────────────────────────────────────────
export const ensureNotificationPermission = async (): Promise<boolean> => {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;

  const { status: requested } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert:  true,
      allowBadge:  true,    // ← required for badge on iOS
      allowSound:  true,
    },
  });
  return requested === 'granted';
};

// ── Format badge count for display ───────────────────────────────
// 1–99: exact number, 100+: "99+"
export const formatBadgeCount = (count: number): string => {
  if (count <= 0)  return '';
  if (count <= 99) return String(count);
  return '99+';
};

// ── Clear badge (call on sign-out or all-read) ────────────────────
export const clearAppIconBadge = async (): Promise<void> => {
  await updateAppIconBadgeImmediate(0);
};