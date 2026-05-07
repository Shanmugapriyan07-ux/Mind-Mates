import { useState, useCallback, useEffect } from 'react';
import { Platform }   from 'react-native';
import { supabase }   from '@/lib/supabase';
import { useAuthh }    from '@/Contexts/authContext';
import Toast          from 'react-native-toast-message';

export type ConnectStatus = 'none' | 'pending' | 'accepted' | 'rejected';
export interface ConnectTarget {
  userId: string; fullName: string;
  profileImage: string | null; skills: string; location?: string;
}

const CACHE_KEY = (uid: string) => `conn_status_v3_${uid}`;

// Web-safe cache
const cacheGet = async (k: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(k);
    return require('@react-native-async-storage/async-storage').default.getItem(k);
  } catch { return null; }
};
const cacheSet = async (k: string, v: string) => {
  try {
    if (Platform.OS === 'web') { localStorage.setItem(k, v); return; }
    require('@react-native-async-storage/async-storage').default.setItem(k, v).catch(() => {});
  } catch {}
};
const cacheDel = async (k: string) => {
  try {
    if (Platform.OS === 'web') { localStorage.removeItem(k); return; }
    require('@react-native-async-storage/async-storage').default.removeItem(k).catch(() => {});
  } catch {}
};

// ── callFn — robust error handling ───────────────────────────
// TEACHING: Supabase edge function errors come in two forms:
//
//   Form 1: HTTP error (4xx/5xx) → error object from .invoke()
//     error.context = Response object with body containing our JSON
//     Must read: const text = await error.context.text()
//     Then parse the JSON to get { error, alreadyExists, status, etc. }
//
//   Form 2: Success but data.error set
//     Edge function returned 200 but with { error: "message" }
//
// We handle BOTH forms and preserve structured fields ✅
const callFn = async (body: Record<string, any>): Promise<any> => {
  console.log(`🔵 callFn: ${body.action}`, JSON.stringify(body));
  const { data, error } = await supabase.functions.invoke('mindmates', { body });

  if (error) {
    // Try to read structured JSON from the error response body
    let parsed: Record<string, any> = {};
    try {
      if (error.context && typeof error.context.text === 'function') {
        const raw = await error.context.text();
        parsed = JSON.parse(raw);
      } else if (typeof error.context === 'string') {
        parsed = JSON.parse(error.context);
      } else if (error.context && typeof error.context === 'object') {
        parsed = error.context;
      }
    } catch { /* couldn't parse, use defaults */ }

    const message = parsed.error ?? error.message ?? 'Function error';
    const err     = new Error(message) as any;

    // Attach structured fields — key for 409 handling
    err.statusCode     = error.context?.status ?? parsed.statusCode ?? 500;
    err.alreadyExists  = parsed.alreadyExists  ?? false;
    err.existingStatus = parsed.status         ?? 'pending';
    err.connectionId   = parsed.connectionId   ?? null;

    console.error(`🔴 callFn error [${err.statusCode}]:`, message, parsed);
    throw err;
  }

  if (data?.error) {
    const err = new Error(data.error) as any;
    err.statusCode     = data.statusCode     ?? 400;
    err.alreadyExists  = data.alreadyExists  ?? false;
    err.existingStatus = data.status         ?? 'pending';
    err.connectionId   = data.connectionId   ?? null;
    console.error('🔴 callFn data.error:', data.error, data);
    throw err;
  }

  console.log(`🟢 callFn success: ${body.action}`, data);
  return data;
};

export const useConnection = () => {
  const { user } = useAuthh();
  const [statusMap,  setStatusMap]  = useState<Record<string, ConnectStatus>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // Restore cache on boot
  useEffect(() => {
    if (!user?.id) return;
    cacheGet(CACHE_KEY(user.id))
      .then(raw => { if (raw) setStatusMap(JSON.parse(raw)); })
      .catch(() => {});
  }, [user?.id]);

  const persist = useCallback((map: Record<string, ConnectStatus>) => {
    if (user?.id) cacheSet(CACHE_KEY(user.id), JSON.stringify(map));
  }, [user?.id]);

  const setStatus = useCallback((id: string, status: ConnectStatus) => {
    setStatusMap(prev => {
      const next = { ...prev, [id]: status };
      persist(next);
      return next;
    });
  }, [persist]);

  const getStatus = (id: string): ConnectStatus => statusMap[id] ?? 'none';
  const isLoading = (id: string): boolean        => loadingMap[id] ?? false;

  // ── sendRequest ───────────────────────────────────────────
  // TEACHING: 409 Conflict = connection already exists in DB
  //   Appwrite: this was a hard error that crashed the flow
  //   Supabase: we treat it as "sync state from server" — update
  //   statusMap with the real status from the server ✅
  //
  //   This fixes the bug where:
  //     - User A sent request (statusMap = pending)
  //     - App reloaded → statusMap cleared
  //     - UI shows "Connect" again
  //     - User taps → 409 → we now read status from server → show "Requested" ✅
  const sendRequest = useCallback(async (target: ConnectTarget) => {
    if (!user?.id) return;
    const tid = target.userId;
    if (statusMap[tid] === 'pending' || statusMap[tid] === 'accepted') return;

    // Optimistic update
    setStatus(tid, 'pending');
    setLoadingMap(p => ({ ...p, [tid]: true }));

    try {
      const result = await callFn({ action: 'send_request', receiverId: tid });

      // Store connectionId so cancelRequest can find it later
      if (result?.connectionId) {
        const raw   = await cacheGet(CACHE_KEY(user.id));
        const cache = raw ? JSON.parse(raw) : {};
        cache[`conn_${tid}`] = result.connectionId;
        cacheSet(CACHE_KEY(user.id), JSON.stringify(cache));
      }

      console.log('✅ sendRequest success:', target.fullName);

    } catch (e: any) {
      console.error('❌ sendRequest error:', e?.message, 'alreadyExists:', e?.alreadyExists);

      if (e?.alreadyExists || e?.statusCode === 409) {
        // Server says connection exists → sync to correct state
        // Don't show error — just update UI to reflect reality ✅
        const correctStatus = (e?.existingStatus as ConnectStatus) ?? 'pending';
        setStatus(tid, correctStatus);

        // Store connectionId for future cancel
        if (e?.connectionId) {
          const raw   = await cacheGet(CACHE_KEY(user.id));
          const cache = raw ? JSON.parse(raw) : {};
          cache[`conn_${tid}`] = e.connectionId;
          cacheSet(CACHE_KEY(user.id), JSON.stringify(cache));
        }
      } else {
        // Real error → rollback
        setStatus(tid, 'none');
        Toast.show({ type: 'error', text1: 'Failed to send request', text2: e?.message });
      }
    } finally {
      setLoadingMap(p => ({ ...p, [tid]: false }));
    }
  }, [user?.id, statusMap, setStatus]);

  // ── acceptRequest ─────────────────────────────────────────
  const acceptRequest = useCallback(async (
    connectionId: string, notifId: string, fromUserId: string,
  ): Promise<string | null> => {
    if (!user?.id) return null;
    setStatus(fromUserId, 'accepted');
    console.log('acceptRequest:', { connectionId, notifId, fromUserId });
    try {
      const result = await callFn({ action: 'accept_request', connectionId, notifId });
      console.log('✅ acceptRequest success, chatId:', result?.chatId);
      return result?.chatId ?? null;
    } catch (e: any) {
      console.error('❌ acceptRequest:', e?.message);
      setStatus(fromUserId, 'pending');
      throw e;
    }
  }, [user?.id, setStatus]);

  // ── rejectRequest ─────────────────────────────────────────
  const rejectRequest = useCallback(async (
    connectionId: string, notifId: string, fromUserId: string,
  ) => {
    if (!user?.id) return;
    setStatus(fromUserId, 'none');
    try { await callFn({ action: 'reject_request', connectionId, notifId }); }
    catch (e: any) {
      console.error('❌ rejectRequest:', e?.message);
      setStatus(fromUserId, 'pending');
    }
  }, [user?.id, setStatus]);

  // ── cancelRequest ─────────────────────────────────────────
  const cancelRequest = useCallback(async (targetId: string) => {
    if (!user?.id || statusMap[targetId] !== 'pending') return;
    setStatus(targetId, 'none');
    try {
      const raw    = await cacheGet(CACHE_KEY(user.id));
      const connId = raw ? JSON.parse(raw)[`conn_${targetId}`] : null;
      if (connId) await callFn({ action: 'cancel_request', connectionId: connId });
    } catch (e: any) {
      console.error('❌ cancelRequest:', e?.message);
      setStatus(targetId, 'pending');
    }
  }, [user?.id, statusMap, setStatus]);

  // ── loadStatuses — always syncs cache with server truth ──
  // TEACHING: Cache can be stale (app reload, different device)
  // loadStatuses re-fetches real state from DB for a list of users
  // Called when: search results appear, match cards appear ✅
  const loadStatuses = useCallback(async (userIds: string[]) => {
    if (!user?.id || !userIds.length) return;
    try {
      const [{ data: sent }, { data: recv }] = await Promise.all([
        supabase.from('connections').select('receiver_id, status, id')
          .eq('sender_id', user.id).in('receiver_id', userIds),
        supabase.from('connections').select('sender_id, status, id')
          .eq('receiver_id', user.id).in('sender_id', userIds),
      ]);

      const fresh: Record<string, ConnectStatus> = {};
      userIds.forEach(uid => { fresh[uid] = 'none'; });
      (sent ?? []).forEach((d: any) => { fresh[d.receiver_id] = d.status as ConnectStatus; });
      (recv ?? []).forEach((d: any) => { if (fresh[d.sender_id] === 'none') fresh[d.sender_id] = d.status as ConnectStatus; });

      setStatusMap(prev => {
        const merged = { ...prev, ...fresh };
        persist(merged);
        return merged;
      });
    } catch (e: any) { console.error('❌ loadStatuses:', e?.message); }
  }, [user?.id, persist]);

  const clearStatuses = useCallback(() => {
    if (!user?.id) return;
    setStatusMap({});
    cacheDel(CACHE_KEY(user.id));
  }, [user?.id]);

  return {
    getStatus, isLoading, setStatus,
    sendRequest, acceptRequest, rejectRequest,
    cancelRequest, loadStatuses, clearStatuses,
  };
};