// services/notificationService.ts
//
// ══════════════════════════════════════════════════════════════════
// NOTIFICATION SERVICE — Push + Foreground + Badge from Payload
// ══════════════════════════════════════════════════════════════════
//
// FOREGROUND vs BACKGROUND STRATEGY:
//
//   FOREGROUND (app is open):
//     - Supabase Realtime fires → syncService updates store + badge
//     - Push notifications are SUPPRESSED (no alert popup)
//       because realtime already handled it
//     - UX: silent badge update, no interruption
//
//   BACKGROUND / KILLED (app not running):
//     - Supabase Realtime is disconnected
//     - Backend sends Expo push notification WITH badge count in payload
//     - OS receives notification → reads badge from payload → updates launcher
//     - User opens app → AppState listener fires → fresh re-sync
//
//   RESULT: Badge is ALWAYS accurate regardless of app state.
//
// PUSH PAYLOAD STRUCTURE (backend must send this):
//   {
//     "to": "ExponentPushToken[...]",
//     "title": "MindMates",
//     "body": "John: Hey!",
//     "badge": 5,              ← CRITICAL: this drives iOS badge
//     "data": {
//       "type": "message",
//       "chatId": "...",
//       "senderId": "...",
//       "totalUnread": 5       ← used for Android badge sync on open
//     },
//     "channelId": "messages"  ← Android notification channel
//   }

import * as Notifications from 'expo-notifications';
import { Platform }        from 'react-native';
import { supabase }        from '@/lib/supabase';
import { ensureNotificationPermission } from './badgeService';

// ── Foreground notification behavior ─────────────────────────────
// SUPPRESSED: when app is open, push notifications don't show alerts.
// Realtime handles the update — no duplicate alert.
// Badge is still set via setBadgeCountAsync in badgeService.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as any;

    // Suppress chat/notification alerts when app is in foreground
    // because realtime subscription already updated the UI
    const isChatOrNotif = data?.type === 'message' || data?.type === 'notification';

    return {
      shouldShowAlert:   !isChatOrNotif,  // suppress foreground alerts for chat
      shouldPlaySound:   false,
      shouldSetBadge:    true,            // still update badge count
      shouldShowBanner:  !isChatOrNotif,
      shouldShowList:    true,
    };
  },
});

// ── Register for push notifications ──────────────────────────────
// Call once after login. Saves the Expo push token to your backend
// so it can send push notifications to this device.
export const registerPushToken = async (userId: string): Promise<string | null> => {
  try {
    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) {
      console.warn('[NotifService] Permission not granted — push disabled');
      return null;
    }

    // Android: notification channel must exist before getting token
    if (Platform.OS === 'android') {
      await setupAndroidChannels();
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID!,
    });

    const token = tokenData.data;
    console.log('[NotifService] Push token:', token);

    // Save token to backend — used by your Supabase Edge Function to send pushes
    await saveTokenToBackend(userId, token);

    return token;
  } catch (e) {
    console.error('[NotifService] Failed to register push token:', e);
    return null;
  }
};

// ── Save token to Supabase ────────────────────────────────────────
// Upsert — handles token refresh (tokens can change after OS update)
const saveTokenToBackend = async (userId: string, token: string): Promise<void> => {
  const platform = Platform.OS;

  await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id:    userId,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform' }  // one token per user per platform
    );
};

// ── Android notification channels ────────────────────────────────
// Channels control sound, vibration, importance per notification type.
// Must be created before sending any notification on Android 8+.
export const setupAndroidChannels = async (): Promise<void> => {
  await Promise.all([
    // Messages channel — high importance, sound + vibration
    Notifications.setNotificationChannelAsync('messages', {
      name:              'Messages',
      importance:         Notifications.AndroidImportance.HIGH,
      enableVibrate:      true,
      vibrationPattern:   [0, 250, 250, 250],
      enableLights:       true,
      lightColor:         '#6D4AFF',
      sound:             'default',
      showBadge:          true,
      description:       'New message notifications',
    }),

    // Notifications channel — default importance
    Notifications.setNotificationChannelAsync('notifications', {
      name:       'Notifications',
      importance:  Notifications.AndroidImportance.DEFAULT,
      enableVibrate: true,
      sound:       'default',
      showBadge:   true,
      description: 'Activity notifications',
    }),

    // Silent badge sync channel — MIN importance (invisible to user)
    Notifications.setNotificationChannelAsync('badge_sync', {
      name:       'Badge Sync',
      importance:  Notifications.AndroidImportance.MIN,
      enableVibrate: false,
      enableLights:  false,
      sound:         null,
      showBadge:     true,
      description:   'Internal badge count sync. Not user-visible.',
    }),
  ]);
};

// ── Response handler (user tapped a notification) ─────────────────
// Called when user taps a push notification from the background.
// Navigate to the relevant screen.
export const setupNotificationResponseListener = (
  onMessage:      (chatId: string) => void,
  onNotification: ()               => void,
): (() => void) => {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as any;

    if (data?.type === 'message' && data?.chatId) {
      onMessage(data.chatId);
    } else if (data?.type === 'notification') {
      onNotification();
    }
  });

  // Return cleanup function — call in useEffect cleanup
  return () => sub.remove();
};

// ── Last notification response (app opened from killed via push) ───
// When app is killed and user taps notification, the notification
// response is available via getLastNotificationResponseAsync().
// Handle this on app startup to navigate to the correct screen.
export const handleKilledStateNotification = async (
  onMessage:      (chatId: string) => void,
  onNotification: ()               => void,
): Promise<void> => {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;

  const data = response.notification.request.content.data as any;
  const notifAge = Date.now() - new Date(
    response.notification.date * 1000  // expo uses seconds
  ).getTime();

  // Only handle recent notifications (< 30s old)
  // Stale notifications from previous app sessions should be ignored
  if (notifAge > 30_000) return;

  if (data?.type === 'message' && data?.chatId) {
    onMessage(data.chatId);
  } else if (data?.type === 'notification') {
    onNotification();
  }
};