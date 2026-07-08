import { useNotificationStore } from '@/stores/notificationStore';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

export interface NotificationData {
  type:        string;
  url:         string;
  chatId?:     string;
  senderId?:   string;
  senderName?: string;
  senderImage?: string;
}

let _lastNavigatedUrl = '';
let _lastNavigatedAt  = 0;
let _navRef: { isReady: () => boolean } | null = null;

export const registerNavRef = (ref: { isReady: () => boolean }) => {
  _navRef = ref;
};

const safeNavigate = (url: string, fullData?: NotificationData) => {
  const now = Date.now();
  if (url === _lastNavigatedUrl && now - _lastNavigatedAt < 2000) {
    return;
  }
  _lastNavigatedUrl = url;
  _lastNavigatedAt  = now;

  const route = resolveRoute(url, fullData);

  const tryPush = (attempts: number) => {
    try {
      if (!_navRef?.isReady()) {
        if (attempts > 0) setTimeout(() => tryPush(attempts - 1), 150);
        return;
      }
      router.push(route as any);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (attempts > 0 && (
        msg.includes('before') ||
        msg.includes('mount') ||
        msg.includes('Unmatched') ||
        msg.includes('unmatched')
      )) {
        setTimeout(() => tryPush(attempts - 1), 150);
        return;
      }
      console.warn('[DeepLink] push failed:', msg);
      try { router.replace('/(tabs)/home' as any); } catch {}
    }
  };
  tryPush(20);
};
const resolveRoute = (url: string, fullData?: NotificationData): object => {
  const chatMatch = url.match(/^\/subScreens\/chatScreen\/([^/]+)$/);
  if (chatMatch) {
    return {
      pathname: '/subScreens/chatScreen/[chatId]',
      params: {
        chatId:      chatMatch[1],
        senderName:  fullData?.senderName  ?? '',
        senderImage: fullData?.senderImage ?? '',
        senderId:    fullData?.senderId    ?? '',
      },
    };
  }
  const userMatch = url.match(/^\/subScreens\/userProfile\/([^/]+)$/);
  if (userMatch) {
    return {
      pathname: '/subScreens/userProfile/[userId]',
      params:   { userId: userMatch[1] },
    };
  }
  return { pathname: url };
};
const _setPending = (url: string) =>
  useNotificationStore.getState().setPendingNavigation({ screen: url, params: {} });

const _clearPending = () =>
  useNotificationStore.getState().setPendingNavigation(null);

const _getPending = (): string | null => {
  const p = useNotificationStore.getState().pendingNavigation;
  return p?.screen ?? null;
};
export const flushPendingNavigation = () => {
  const url = _getPending();
  if (!url) return;
  _clearPending();
  safeNavigate(url);
};
export const navigateFromNotification = (data: NotificationData) => {
  const url = data?.url;
  if (!url || data?.type === 'badge_sync') return;
  safeNavigate(url, data); 
};
export const handleColdStartNotification = async () => {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return;
    const data = response.notification.request.content.data as unknown as NotificationData;
    if (!data?.url) return;
    _setPending(data.url);
  } catch (e) {
    console.warn('[DeepLink] cold start check failed:', e);
  }
};

export const resetDeepLinkService = () => {
  _navRef = null;
  _clearPending();
};
