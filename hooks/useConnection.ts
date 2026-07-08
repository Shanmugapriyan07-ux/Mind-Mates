import { useAuthh } from '@/Contexts/authContext';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
export type ConnectStatus = 'none' | 'pending' | 'accepted' | 'rejected';
const CACHE_KEY = (uid: string) => `conn_status_v3_${uid}`;
export interface ConnectTarget {
  userId: string; fullName: string;
  profileImage: string | null; skills: string; location?: string;
}
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
const callFn = async (body: Record<string, any>): Promise<any> => {
  const { data, error } = await supabase.functions.invoke('mindmates', { body });
  if (error) {
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
    } catch {}
    const message = parsed.error ?? error.message ?? 'Function error';
    const err     = new Error(message) as any;
    err.statusCode     = error.context?.status ?? parsed.statusCode ?? 500;
    err.alreadyExists  = parsed.alreadyExists  ?? false;
    err.existingStatus = parsed.status         ?? 'pending';
    err.connectionId   = parsed.connectionId   ?? null;
    if (err.statusCode !== 409) {
      console.warn(` callFn error [${err.statusCode}]:`, message, parsed);
    }
    throw err;
  }
  if (data?.error) {
    const err = new Error(data.error) as any;
    err.statusCode     = data.statusCode     ?? 400;
    err.alreadyExists  = data.alreadyExists  ?? false;
    err.existingStatus = data.status         ?? 'pending';
    err.connectionId   = data.connectionId   ?? null;
    console.warn(' callFn data.error:', data.error, data);
    throw err;
  }
  return data;
};
export const useConnection = () => {
  const { user } = useAuthh();
  const [statusMap,  setStatusMap]  = useState<Record<string, ConnectStatus>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
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
  const sendRequest = useCallback(async (target: ConnectTarget) => {
    if (!user?.id) return;
    const tid = target.userId;
    if (statusMap[tid] === 'pending' || statusMap[tid] === 'accepted') return;
    setStatus(tid, 'pending');
    setLoadingMap(p => ({ ...p, [tid]: true }));
    try {
      const result = await callFn({ action: 'send_request', receiverId: tid });
      if (result?.connectionId) {
        const raw   = await cacheGet(CACHE_KEY(user.id));
        const cache = raw ? JSON.parse(raw) : {};
        cache[`conn_${tid}`] = result.connectionId;
        cacheSet(CACHE_KEY(user.id), JSON.stringify(cache));
      }
    } catch (e: any) {
      if (e?.alreadyExists || e?.statusCode === 409) {
        const correctStatus = (e?.existingStatus as ConnectStatus) ?? 'pending';
        setStatus(tid, correctStatus);
        if (e?.connectionId) {
          const raw   = await cacheGet(CACHE_KEY(user.id));
          const cache = raw ? JSON.parse(raw) : {};
          cache[`conn_${tid}`] = e.connectionId;
          cacheSet(CACHE_KEY(user.id), JSON.stringify(cache));
        }
      } else {
        setStatus(tid, 'none');
        const isServerError = e?.statusCode >= 500 && e?.statusCode <= 599;
        if (!isServerError) {
          console.warn({ type: 'error', text1: 'Failed to send request', text2: e?.message });
        }
      }
    } finally {
      setLoadingMap(p => ({ ...p, [tid]: false }));
    }
  }, [user?.id, statusMap, setStatus]);
  const acceptRequest = useCallback(async (
    connectionId: string, notifId: string, fromUserId: string,
  ): Promise<string | null> => {
    if (!user?.id) return null;
    setStatus(fromUserId, 'accepted');
    try {
      const result = await callFn({ action: 'accept_request', connectionId, notifId });
      return result?.chatId ?? null;
    } catch (e: any) {
      console.warn(' acceptRequest:', e?.message);
      setStatus(fromUserId, 'pending');
      throw e;
    }
  }, [user?.id, setStatus]);
  const rejectRequest = useCallback(async (
    connectionId: string, notifId: string, fromUserId: string,
  ) => {
    if (!user?.id) return;
    setStatus(fromUserId, 'none');
    try { await callFn({ action: 'reject_request', connectionId, notifId }); }
    catch (e: any) {
      console.warn(' rejectRequest:', e?.message);
      setStatus(fromUserId, 'pending');
    }
  }, [user?.id, setStatus]);
  const cancelRequest = useCallback(async (targetId: string) => {
    if (!user?.id || statusMap[targetId] !== 'pending') return;
    setStatus(targetId, 'none');
    try {
      const raw    = await cacheGet(CACHE_KEY(user.id));
      const connId = raw ? JSON.parse(raw)[`conn_${targetId}`] : null;
      if (connId) await callFn({ action: 'cancel_request', connectionId: connId });
    } catch (e: any) {
      console.warn(' cancelRequest failed, reverting status:', e?.message);
      setStatus(targetId, 'pending');
    }
  }, [user?.id, statusMap, setStatus]);
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
    } catch (e: any) { }
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