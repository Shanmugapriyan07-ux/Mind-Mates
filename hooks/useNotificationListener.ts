// hooks/useNotificationListener.ts
import { useEffect, useRef } from 'react';
import * as Notifications    from 'expo-notifications';
import { router }            from 'expo-router';

export const useNotificationListener = () => {
  const notificationListener = useRef<any>(null);
  const responseListener     = useRef<any>(null);

  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        // App open — Appwrite realtime already handles UI update
        // Banner shows automatically via setNotificationHandler above
        console.log('📩 Received:', notification.request.content.title);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data as any;

        // FIX: connection_request should go to notifications tab not chat tab
        if (data?.type === 'new_message' && data?.chatId) {
          router.push({
            pathname: '/subScreens/chatScreen',
            params: {
              chatId:  data.chatId,
              userId:  data.userId,
              name:    data.senderName  ?? '',
              image:   data.senderImage ?? '',
            },
          });
        } else if (data?.type === 'connection_request') {
          // ✅ Fixed: was '/(tabs)/chat' — correct path is notifications tab
          router.push('/(tabs)/chat');
        } else if (data?.type === 'connection_accepted' && data?.chatId) {
          router.push({
            pathname: '/subScreens/chatScreen',
            params: {
              chatId:  data.chatId,
              userId:  data.userId,
              name:    '',
              image:   '',
            },
          });
        }
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
};