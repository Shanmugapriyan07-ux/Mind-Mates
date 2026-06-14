import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/stores/chatStore';
import { useNotificationStore } from '@/stores/notificationStore';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Foreground handler — show alert in foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as any;
    const activeChatId = useChatStore.getState().activeChatId;

    // Suppress banner + sound if user is already in this chat
    const isInActiveChat =
      data?.type === 'new_message' &&
      data?.chatId &&
      activeChatId === data.chatId;

    if (isInActiveChat) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge:  false,
        shouldShowBanner: false,
        shouldShowList:   false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
      shouldShowBanner: true,
      shouldShowList:   true,
    };
  },
});

export type NotificationPayload = {
  type: 'new_message' | 'friend_request' | 'request_accepted';
  chatId?: string;
  senderId?: string;
  senderName?: string;
  senderImage?: string;
  url: string;
  params?: Record<string, string>;
};

class NotificationService {
  private responseListener: Notifications.Subscription | null = null;
  private foregroundListener: Notifications.Subscription | null = null;
  private retryAttempts = 0;
  private maxRetries = 3;
  private retryDelay = 1000; // ms

  private isValidToken(token: string | null | undefined): boolean {
    if (!token || typeof token !== 'string') return false;
    // Expo tokens should look like: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx]
    return /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(token);
  }

  async registerForPushNotifications(userId: string): Promise<string | null> {
    try {
      // ✓ Check device capabilities
      if (!Device.isDevice) {
        console.warn('[NotificationService] Not a physical device — skipping push registration');
        return null;
      }

      // ✓ Get projectId from environment or app.config.js
      let projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
      
      if (!projectId) {
        // Fallback: get from app.config.js via Constants
        try {
          projectId = (Constants.expoConfig?.extra?.eas?.projectId as string) || null;
          if (projectId) {
            console.log('[NotificationService] Using projectId from app.config.js');
          }
        } catch (err) {
          console.warn('[NotificationService] Could not read projectId from Constants', err);
        }
      }

      if (!projectId) {
        console.error('[NotificationService] EXPO_PUBLIC_EAS_PROJECT_ID not set and not found in app.config.js');
        return null;
      }

      // ✓ Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[NotificationService] Push permissions denied by user');
        return null;
      }

      // ✓ Setup Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'MindMates',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#7C3AED',
          sound: 'default',
        });
      }

      // ✓ Get token with validation
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const rawToken = tokenResponse.data;
      const token = typeof rawToken === 'string' ? rawToken.trim() : rawToken;

      if (!this.isValidToken(token)) {
        console.error('[NotificationService] Invalid token format received', {
          token,
          length: token?.length,
        });
        return null;
      }

      // ✓ Save token to Supabase with error handling
      await this.saveTokenToSupabase(userId, token);
      useNotificationStore.getState().setExpoPushToken(token);

      console.log('[NotificationService] ✓ Token registered successfully', {
        userId,
        tokenPreview: token.substring(0, 10) + '...',
        fullToken: token, // Log full token for debugging/testing
      });

      this.retryAttempts = 0; // Reset retry counter on success
      return token;
    } catch (error) {
      const isMissingUser = (error as any)?.message === 'USER_RECORD_NOT_FOUND';

      if (isMissingUser) {
        console.warn('[NotificationService] Registration pending: waiting for user record in public.users');
      } else {
        console.error('[NotificationService] Registration failed', error);
      }

      // ✓ Retry logic for transient failures
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        const delay = this.retryDelay * Math.pow(2, this.retryAttempts - 1);
        console.log(`[NotificationService] Retrying in ${delay}ms (attempt ${this.retryAttempts}/${this.maxRetries})`);
        setTimeout(() => {
          this.registerForPushNotifications(userId).catch(() => {});
        }, delay);
      }

      return null;
    }
  }

  private async saveTokenToSupabase(userId: string, token: string) {
    try {
      // ✓ Verify user exists in public.users to avoid Foreign Key violation (Error 23503)
      const { data: user, error: checkErr } = await supabase
        .from('users')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkErr) throw checkErr;
      if (!user) throw new Error('USER_RECORD_NOT_FOUND');

      // Use upsert with the correct unique constraint (user_id, platform)
      const { error } = await supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS, // 'android' or 'ios'
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform' } // Match the unique constraint columns
      );

      if (error) {
        console.error('[NotificationService] Supabase token save error', error);
        throw error;
      }

      console.log('[NotificationService] Token saved to Supabase for user', userId, 'on platform', Platform.OS);
    } catch (error) {
      // Only log as a hard error if it's NOT the expected missing user record
      if ((error as any)?.message !== 'USER_RECORD_NOT_FOUND') {
        console.error('[NotificationService] Failed to save token to Supabase', error);
      }
      throw error;
    }
  }

  // Called on app launch — handles killed-state tap
  async getInitialNotification(): Promise<NotificationPayload | null> {
    try {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) return null;
      return response.notification.request.content.data as NotificationPayload;
    } catch (error) {
      console.error('[NotificationService] Failed to get initial notification', error);
      return null;
    }
  }

  async deleteTokenForUser(userId: string): Promise<void> {
    try {
      const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId);
      if (error) throw error;
      console.log('[NotificationService] Token deleted for user', userId);
    } catch (error) {
      console.error('[NotificationService] Failed to delete token', error);
    }
  }

  // Listen for taps while app is backgrounded/foregrounded
  listenForNotificationTaps(onTap: (payload: NotificationPayload) => void) {
    if (this.responseListener) {
      console.warn('[NotificationService] Response listener already registered');
      return;
    }

    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const payload = response.notification.request.content.data as NotificationPayload;
        onTap(payload);
      } catch (error) {
        console.error('[NotificationService] Error handling notification tap', error);
      }
    });
  }

  // Listen for foreground notifications (suppress push, use realtime instead)
  listenForForegroundNotifications(onReceive: (payload: NotificationPayload) => void) {
    if (this.foregroundListener) {
      console.warn('[NotificationService] Foreground listener already registered');
      return;
    }

    this.foregroundListener = Notifications.addNotificationReceivedListener((notification) => {
      try {
        const payload = notification.request.content.data as NotificationPayload;
        onReceive(payload);
      } catch (error) {
        console.error('[NotificationService] Error handling foreground notification', error);
      }
    });
  }

  destroy() {
    this.responseListener?.remove();
    this.foregroundListener?.remove();
    this.responseListener = null;
    this.foregroundListener = null;
  }

  // ── DEBUG: Get the stored token for testing push notifications ──────────
  async debugGetCurrentToken(): Promise<string | null> {
    const token = useNotificationStore.getState().expoPushToken;
    if (token) {
      console.log('[NotificationService] DEBUG: Current stored token:', token);
      return token;
    }
    console.warn('[NotificationService] DEBUG: No token currently stored');
    return null;
  }
}

export const notificationService = new NotificationService();