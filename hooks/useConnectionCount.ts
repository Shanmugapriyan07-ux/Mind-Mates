import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export const useConnectionCount = (userId: string | undefined) => {
  const [count,   setCount]   = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCount = useCallback(async () => {
    // TEACHING: Guard against undefined/empty — Supabase will query
    // with literal "undefined" string if you don't guard ❌
    const uid = userId?.trim();
    if (!uid) { setCount(0); return; }

    setLoading(true);
    try {
      // Count rows where uid appears as sender OR receiver
      // .or() builds: (sender_id = uid) OR (receiver_id = uid)
      const { count: total, error } = await supabase
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);

      if (error) {
        // Most common error: RLS blocking → run fix_connections_rls.sql
        console.error('❌ useConnectionCount RLS error:', error.message);
        setCount(0);
        return;
      }

      setCount(total ?? 0);
    } catch (e: any) {
      console.error('❌ useConnectionCount:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  return { count, loading, refetch: fetchCount };
};