import { supabase } from '@/config/supabase';
import { realtimeService } from '@/services/realtimeService';
import { useAuthStore } from '@/stores/authStore';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
export function useAppState(chatId?: string) {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const { user } = useAuthStore();
  AppState.addEventListener('change', (nextState) => {
    if (!user?.id) return;
    if (supabase && (nextState === 'background' || nextState === 'inactive')) {
    supabase
      .from('user_presence')
      .update({ 
        is_online: false,
        active_chat_id: null,   
        last_seen: new Date().toISOString() 
      })
      .eq('user_id', user.id);
  }
  if (supabase && nextState === 'active') {
    supabase
      .from('user_presence')
      .update({ is_online: true })  
      .eq('user_id', user.id);
  }
});
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prev = appState.current;
      appState.current = nextState;
      if (prev.match(/inactive|background/) && nextState === 'active') {
        if (chatId) {
          realtimeService.unsubscribe(`chat:${chatId}`);
        }
      }
      if (nextState === 'background') {
      }
    });
    return () => subscription.remove();
  }, [chatId, user?.id]);
}