import { useEffect, useRef } from 'react';
import * as Notifications    from 'expo-notifications';
import { router }            from 'expo-router';
import { useChatStore }      from '@/stores/chatStore';

export const useNotificationListener = () => {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener     = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as any;
        const activeChatId = useChatStore.getState().activeChatId;
        if (
          data?.type === 'new_message' &&
          data?.chatId &&
          activeChatId === data.chatId
        ) {
          return;
        }
      }
    );
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as any;
        if (!data?.type) return;

        switch (data.type) {
          case 'new_message':
            if (data.chatId && data.userId) {
              const activeChatId = useChatStore.getState().activeChatId;
              if (activeChatId === data.chatId) return;
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
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
};