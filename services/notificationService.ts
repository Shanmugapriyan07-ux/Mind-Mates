import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/stores/chatStore';
import { useNotificationStore } from '@/stores/notificationStore';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
export type NotificationPayload = {
  type:         'new_message' | 'connection_request' | 'connection_accepted' | 'daily_morning' | 'daily_night';
  chatId?:      string;
  senderId?:    string;
  senderName?:  string;
  senderImage?: string;
  url:          string;
};
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data         = notification.request.content.data as NotificationPayload;
    const activeChatId = useChatStore.getState().activeChatId;
    if ((data?.type as string) === 'badge_sync') {
      return {
        shouldPlaySound:  false,
        shouldSetBadge:   false,
        shouldShowBanner: false,
        shouldShowList:   false,
      };
    }
    const suppressForActiveChat =
      data?.type === 'new_message' &&
      data?.chatId != null &&
      activeChatId === data.chatId;
    if (suppressForActiveChat) {
      return {
        shouldPlaySound:  false,
        shouldSetBadge:   false,
        shouldShowBanner: false,
        shouldShowList:   false,
      };
    }
    return {
      shouldPlaySound:  true,
      shouldSetBadge:   true,
      shouldShowBanner: true,
      shouldShowList:   true,
    };
  },
});
class NotificationService {
  private _tapListener:        Notifications.Subscription | null = null;
  private _foregroundListener: Notifications.Subscription | null = null;
  private _retryCount  = 0;
  private _maxRetries  = 3;
  private _retryBaseMs = 1000;
  private _isValidToken(token: unknown): token is string {
    if (!token || typeof token !== 'string') return false;
    return /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(token.trim());
  }

  async registerForPushNotifications(userId: string): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.warn('[Notif] Skipping — not a physical device');
        return null;
      }
      const projectId =
        (process.env.EXPO_PUBLIC_EAS_PROJECT_ID as string | undefined) ||
        (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ||
        null;

      if (!projectId) {
        console.warn('[Notif] EAS projectId not configured');
        return null;
      }
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.warn('[Notif] Permission denied by user');
        return null;
      }
      if (Platform.OS === 'android') {
        await this._createAndroidChannels();
      }
      const { data: rawToken } = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = typeof rawToken === 'string' ? rawToken.trim() : rawToken;

      if (!this._isValidToken(token)) {
        console.warn('[Notif] Invalid token received:', token);
        return null;
      }
      await this._saveTokenToSupabase(userId, token);
      useNotificationStore.getState().setExpoPushToken(token);
      this._retryCount = 0;
      return token;
    } catch (err: any) {
  const msg  = err?.message ?? '';
  const code = err?.code   ?? '';
  const isFirebaseError = msg.includes('FirebaseApp is not initialized') ||
                          msg.includes('FirebaseApp.initializeApp') ||
                          code === 'E_REGISTRATION_FAILED';
  if (isFirebaseError) {
    console.warn('[Notif] Firebase not initialized — native rebuild required');
    return null; 
  }
  const isMissingUser  = msg === 'USER_RECORD_NOT_FOUND';
  const isUnavailable  = msg.includes('SERVICE_NOT_AVAILABLE');
  if (isUnavailable || isMissingUser) return null;
  if (this._retryCount < this._maxRetries) {
    this._retryCount++;
    const delay = this._retryBaseMs * Math.pow(2, this._retryCount - 1);
    setTimeout(() => {
      this.registerForPushNotifications(userId).catch(() => {});
    }, delay);
  }
  return null;
}
  }
  private async _createAndroidChannels(): Promise<void> {
    await Promise.all([
      Notifications.setNotificationChannelAsync('messages', {
        name:             'Messages',
        importance:       Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#6D4AFF',
        sound:            'default',
        showBadge:        true,
        enableLights:     true,
      }),
      Notifications.setNotificationChannelAsync('social', {
        name:             'Social Activity',
        importance:       Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 150, 100, 150],
        lightColor:       '#6D4AFF',
        sound:            'default',
        showBadge:        true,
        enableLights:     true,
      }),
      Notifications.setNotificationChannelAsync('daily', {
        name:             'Daily Motivation',
        importance:       Notifications.AndroidImportance.DEFAULT,
        sound:            'default',
        enableVibrate:    false,
        showBadge:        false,
      }),
      Notifications.setNotificationChannelAsync('badge_sync_silent', {
        name:          'Badge Sync',
        importance:    Notifications.AndroidImportance.MIN,
        enableVibrate: false,
        showBadge:     true,
        sound:         null,
      }),
    ]);
  }
  private async _saveTokenToSupabase(userId: string, token: string): Promise<void> {
    const { data: userRow } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!userRow) throw new Error('USER_RECORD_NOT_FOUND');

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id:    userId,
        token,
        platform:   Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform' },
    );

    if (error) {
      console.warn('[Notif] Token save error:', error.message);
      throw error;
    }
  }
  async getInitialNotification(): Promise<NotificationPayload | null> {
    try {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) return null;
      return response.notification.request.content.data as NotificationPayload;
    } catch (e) {
      console.warn('[Notif] getInitialNotification error:', e);
      return null;
    }
  }
  async deleteTokenForUser(userId: string): Promise<void> {
    try {
      await supabase.from('push_tokens').delete().eq('user_id', userId);
      useNotificationStore.getState().setExpoPushToken('');
    } catch (e) {
      console.warn('[Notif] deleteToken error:', e);
    }
  }
  listenForNotificationTaps(onTap: (payload: NotificationPayload) => void): void {
    if (this._tapListener) return;
    this._tapListener = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        const data = response.notification.request.content.data as NotificationPayload;
        if (!data?.url || (data.type as string) === 'badge_sync') return;
        onTap(data);
      } catch (e) {
        console.error('[Notif] Tap listener error:', e);
      }
    });
  }
  listenForForegroundNotifications(onReceive: (payload: NotificationPayload) => void): void {
    if (this._foregroundListener) return;
    this._foregroundListener = Notifications.addNotificationReceivedListener(notification => {
      try {
        const data = notification.request.content.data as NotificationPayload;
        if (!data?.url || (data.type as string) === 'badge_sync') return;
        onReceive(data);
      } catch (e) {
        console.error('[Notif] Foreground listener error:', e);
      }
    });
  }
  destroy(): void {
    this._tapListener?.remove();
    this._foregroundListener?.remove();
    this._tapListener        = null;
    this._foregroundListener = null;
  }
}

export const notificationService = new NotificationService();