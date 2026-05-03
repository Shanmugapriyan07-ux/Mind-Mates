// // hooks/usePresence.ts
// //
// // TEACHING: How presence (online/offline) works

import { useEffect, useRef } from 'react';
import { AppState }          from 'react-native';
import { supabase }          from '@/lib/supabase';
import { useAuthh }           from '@/Contexts/authContext';

export const usePresence = () => {
  const { user } = useAuthh();
  const timer = useRef<any>(null);

  const beat = async (uid: string) => {
    await supabase.from('users')
      .update({ last_seen: new Date().toISOString() })
      .eq('user_id', uid)
      .match(() => {});
  };

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    beat(uid);
    timer.current = setInterval(() => beat(uid), 30_000);

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') beat(uid);
    });

    return () => {
      clearInterval(timer.current);
      sub.remove();
    };
  }, [user?.id]);
};