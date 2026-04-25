// hooks/usePushNotifications.ts
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device        from 'expo-device';
import { Platform }       from 'react-native';
import supabase, { databases, config, Query, TABLES } from '@/lib/supabase';
 
import { useAuth }           from '@/Contexts/authContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

export const usePushNotifications = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user?.id) return;
    registerAndSaveToken(user.id);
  }, [user?.id]);
};

const registerAndSaveToken = async (userId: string) => {
  try {
    // Skip on web — web push needs VAPID key (different setup)
    // Push notifications on web require separate configuration
    if (typeof document !== 'undefined') {
      console.log('🌐 Push notifications skipped on web');
      return;
    }

    if (!Device.isDevice) {
      console.log('📱 Push notifications require a physical device');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('❌ Push notification permission denied');
      return;
    }

    // FIX 1: Android channel must be created BEFORE getting token
    // Without this on Android 8+, notifications never appear ✅
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name:             'Messages',
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#6D4AFF',
        sound:            'default',
      });
    }

    // FIX 2: Use Constants from expo-constants for projectId
    // process.env.EXPO_PUBLIC_PROJECT_ID is unreliable at runtime
    // Correct way: read from app.json via Constants ✅
    const Constants = (await import('expo-constants')).default;
    const projectId  =
      (Constants as any).expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId ??
      '';

    if (!projectId) {
      console.error('❌ No projectId found. Add to app.json: expo.extra.eas.projectId');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token     = tokenData.data;
    console.log('📬 Push token:', token);

    // ✅ FIX: Use Supabase syntax instead of Appwrite
    const { data: userData, error: fetchError } = await supabase
      .from(TABLES.users)
      .select('id, pushToken')
      .eq('user_id', userId)
      .single();

    if (userData) {
      // Only write if token actually changed — avoids unnecessary DB writes
      if (userData.pushToken !== token) {
        await supabase
          .from(TABLES.users)
          .update({ pushToken: token })
          .eq('id', userData.id);
          
        console.log('✅ Push token saved');
      } else {
        console.log('✅ Push token unchanged — skip write');
      }
    } else {
      console.warn('⚠️ User doc not found for userId:', userId);
    }

  } catch (e: any) {
    console.error('❌ registerAndSaveToken:', e?.message);
  }
};