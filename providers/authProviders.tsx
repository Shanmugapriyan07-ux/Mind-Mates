import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { notificationService } from '@/services/notificationService';
import { realtimeService } from '@/services/realtimeService';
import { flushPendingNavigation } from '@/services/deepLinkService';
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setProfile, setHydrated, logout } = useAuthStore();
  const hydrated = useAuthStore(s => s.hydrated);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await loadProfile(session.user.id);
        await notificationService.registerForPushNotifications(session.user.id);
      }
      setHydrated(); 
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (event === 'SIGNED_IN' && session?.user) {
          await loadProfile(session.user.id);
          await notificationService.registerForPushNotifications(session.user.id);
        }
        if (event === 'SIGNED_OUT') {
          realtimeService.unsubscribeAll();
          notificationService.destroy();
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (hydrated) {
      flushPendingNavigation();
    }
  }, [hydrated]);
  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  }
  return <>{children}</>;
}