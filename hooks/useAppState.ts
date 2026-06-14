// hooks/useAppState.ts
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
        active_chat_id: null,    // ← ADD this line alongside your existing update
        last_seen: new Date().toISOString() 
      })
      .eq('user_id', user.id);
  }

  if (supabase && nextState === 'active') {
    supabase
      .from('user_presence')
      .update({ is_online: true })   // ← active_chat_id stays null until they open a chat
      .eq('user_id', user.id);
  }
});

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prev = appState.current;
      appState.current = nextState;

      if (prev.match(/inactive|background/) && nextState === 'active') {
        // App foregrounded — reconnect realtime
        if (chatId) {
          realtimeService.unsubscribe(`chat:${chatId}`);
          // Hook re-mounts subscription on next render
        }
      }

      if (nextState === 'background') {
        // App backgrounded — push takes over, realtime is paused by OS
        // No action needed; Expo handles push delivery
      }
    });

    return () => subscription.remove();
  }, [chatId, user?.id]);
}