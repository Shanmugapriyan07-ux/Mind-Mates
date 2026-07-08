import supabase, { TABLES } from '@/lib/supabase';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuthh } from '@/Contexts/authContext';
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});
export const usePushNotifications = () => {
  const { user } = useAuthh();
  useEffect(() => {
    if (!user?.id) return;
    registerAndSaveToken(user.id);
  }, [user?.id]);
};
const registerAndSaveToken = async (userId: string) => {
  try {
    if (typeof document !== 'undefined') {
      return;
    }
    if (!Device.isDevice) {
      return;
    }
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name:             'Messages',
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#6D4AFF',
        sound:            'default',
      });
    }
    const Constants = (await import('expo-constants')).default;
    const projectId  =
      (Constants as any).expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId ??
      '';
    if (!projectId) {
      return;
    }
    let tokenData;
    let retries = 0;
    const MAX_RETRIES = 3;
    while (retries < MAX_RETRIES) {
      try {
        tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        break;
      } catch (err: any) {
        retries++;
        if (retries >= MAX_RETRIES) throw err;
        const delay = 2000 * retries;
        console.warn(`[usePushNotifications] Retry ${retries}/${MAX_RETRIES} due to error: ${err.message}`);
        await new Promise(res => setTimeout(res, delay));
      }
    }
    if (!tokenData?.data) {
      console.warn(' Failed to retrieve Expo push token after retries');
      return;
    }
    const token     = tokenData.data;
    const { data: userData } = await supabase
      .from(TABLES.users)
      .select('id, pushToken')
      .eq('user_id', userId)
      .single();
    if (userData) {
      if (userData.pushToken !== token) {
        await supabase
          .from(TABLES.users)
          .update({ pushToken: token })
          .eq('id', userData.id);
      } else {
      }
    } else {
      console.warn(' User doc not found for userId:', userId);
    }
  } catch (e: any) {
  }
};