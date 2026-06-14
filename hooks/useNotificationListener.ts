// hooks/useNotificationListener.ts
import { useEffect, useRef } from 'react';
import * as Notifications    from 'expo-notifications';
import { router }            from 'expo-router';
import { useChatStore }      from '@/stores/chatStore';

export const useNotificationListener = () => {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener     = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // ── Foreground: notification received while app is open ───────────────
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as any;

        // Get currently active chat from store
        const activeChatId = useChatStore.getState().activeChatId;

        // If user is already in this chat — do nothing
        // Realtime subscription already handles the UI update
        if (
          data?.type === 'new_message' &&
          data?.chatId &&
          activeChatId === data.chatId
        ) {
          console.log('[Notif] suppressed foreground alert — user is in this chat');
          return;
        }
      }
    );

    // ── Tap: user tapped a notification ──────────────────────────────────
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as any;
        console.log('[Notif] tapped:', data?.type, data?.chatId?.slice(0, 8));

        if (!data?.type) return;

        switch (data.type) {
          case 'new_message':
            if (data.chatId && data.userId) {
              // Check if already in this chat
              const activeChatId = useChatStore.getState().activeChatId;
              if (activeChatId === data.chatId) return; // already there

              router.push({
                pathname: '/subScreens/chatScreen',
                params: {
                  chatId:  data.chatId,
                  userId:  data.userId,
                  name:    data.senderName  ?? '',
                  image:   data.senderImage ?? '',
                },
              });
            }
            break;

          case 'connection_request':
            router.push('/(tabs)/chat' as any);
            break;

          case 'connection_accepted':
            if (data.chatId && data.userId) {
              router.push({
                pathname: '/subScreens/chatScreen',
                params: {
                  chatId: data.chatId,
                  userId: data.userId,
                  name:   data.senderName  ?? '',
                  image:  data.senderImage ?? '',
                },
              });
            }
            break;

          default:
            console.log('[Notif] unhandled type:', data.type);
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
};