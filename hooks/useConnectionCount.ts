import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
export const useConnectionCount = (userId: string | undefined) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCount = useCallback(async () => {
    const uid = userId?.trim();
    if (!uid) { setCount(0); return; }

    let cancelled = false;
    setLoading(true);
    try {
      const { count: total, error } = await supabase
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);

      if (cancelled) return;
      if (error) {
        console.warn(' useConnectionCount RLS error:', error.message);
        setCount(0);
        return;
      }
      setCount(total ?? 0);
    } catch (e: any) {
      if (!cancelled) console.warn(' useConnectionCount:', e?.message);
    } finally {
      if (!cancelled) setLoading(false);
    }

    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const uid = userId?.trim();
    if (!uid) { setCount(0); return; }

    (async () => {
      setLoading(true);
      try {
        const { count: total, error } = await supabase
          .from('connections')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'accepted')
          .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);

        if (cancelled) return;
        if (error) {
          console.warn('useConnectionCount RLS error:', error.message);
          setCount(0);
          return;
        }
        setCount(total ?? 0);
      } catch (e: any) {
        if (!cancelled) console.warn(' useConnectionCount:', e?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  const refetch = useCallback(async () => {
    const uid = userId?.trim();
    if (!uid) { setCount(0); return; }
    setLoading(true);
    try {
      const { count: total, error } = await supabase
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);
      if (error) {
        console.warn(' useConnectionCount RLS error:', error.message);
        setCount(0);
        return;
      }
      setCount(total ?? 0);
    } catch (e: any) {
      console.warn(' useConnectionCount:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { count, loading, refetch };
};