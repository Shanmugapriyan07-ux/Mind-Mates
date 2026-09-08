import { useAuthh } from '@/Contexts/authContext';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';

export type ConnectStatus = 'none' | 'pending' | 'accepted' | 'rejected';
const CACHE_KEY = (uid: string) => `conn_status_v3_${uid}`;

export interface ConnectTarget {
  userId: string; fullName: string;
  profileImage: string | null; skills: string; location?: string;
}

const cacheGet = async (k: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(k);
    return AsyncStorage.getItem(k);
  } catch { return null; }
};
const cacheSet = async (k: string, v: string) => {
  try {
    if (Platform.OS === 'web') { localStorage.setItem(k, v); return; }
    AsyncStorage.setItem(k, v).catch(() => {});
  } catch {}
};
const cacheDel = async (k: string) => {
  try {
    if (Platform.OS === 'web') { localStorage.removeItem(k); return; }
    AsyncStorage.removeItem(k).catch(() => {});
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
    const err = new Error(message) as any;
    err.statusCode = error.context?.status ?? parsed.statusCode ?? 500;
    err.alreadyExists = parsed.alreadyExists ?? false;
    err.existingStatus = parsed.status ?? 'pending';
    err.connectionId = parsed.connectionId ?? null;
    if (err.statusCode !== 409) {
      console.warn(` callFn error [${err.statusCode}]:`, message, parsed);
    }
    throw err;
  }
  if (data?.error) {
    const err = new Error(data.error) as any;
    err.statusCode = data.statusCode ?? 400;
    err.alreadyExists = data.alreadyExists ?? false;
    err.existingStatus = data.status ?? 'pending';
    err.connectionId = data.connectionId ?? null;
    console.warn(' callFn data.error:', data.error, data);
    throw err;
  }
  return data;
};

// ── Shared store — single source of truth for connection status across
// every consumer (DiscoverScreen, every ConnectButton, any future screen),
// replacing what used to be independent per-component-instance useState.
interface ConnectionStoreState {
  statusMap: Record<string, ConnectStatus>;
  loadingMap: Record<string, boolean>;
  hydratedFor: string | null;
  mergeStatuses: (fresh: Record<string, ConnectStatus>, uid: string | null) => void;
  setStatus: (id: string, status: ConnectStatus, uid: string | null) => void;
  setLoading: (id: string, loading: boolean) => void;
  hydrate: (uid: string) => Promise<void>;
  reset: () => void;
}

const useConnectionStore = create<ConnectionStoreState>((set, get) => ({
  statusMap: {},
  loadingMap: {},
  hydratedFor: null,

  mergeStatuses: (fresh, uid) => {
    set((state) => {
      const next = { ...state.statusMap, ...fresh };
      if (uid) cacheSet(CACHE_KEY(uid), JSON.stringify(next));
      return { statusMap: next };
    });
  },

  setStatus: (id, status, uid) => {
    set((state) => {
      const next = { ...state.statusMap, [id]: status };
      if (uid) cacheSet(CACHE_KEY(uid), JSON.stringify(next));
      return { statusMap: next };
    });
  },

  setLoading: (id, loading) => {
    set((state) => ({ loadingMap: { ...state.loadingMap, [id]: loading } }));
  },

  hydrate: async (uid) => {
    // Only ever read the cache once per user per app session — every
    // consumer calling hydrate() again for the same uid is a safe no-op,
    // eliminating the N-redundant-reads problem from N rendered buttons.
    if (get().hydratedFor === uid) return;
    const raw = await cacheGet(CACHE_KEY(uid));
    if (raw) {
      try {
        set({ statusMap: JSON.parse(raw), hydratedFor: uid });
        return;
      } catch {}
    }
    set({ hydratedFor: uid });
  },

  reset: () => set({ statusMap: {}, loadingMap: {}, hydratedFor: null }),
}));

// Narrow selector hooks — a component that only cares about ONE user's
// status/loading state should use these instead of useConnection()'s
// getStatus()/isLoading(), so it only re-renders when THAT specific
// value changes, not on every unrelated status update anywhere on screen.
export const useConnectionStatus = (userId: string): ConnectStatus =>
  useConnectionStore((s) => s.statusMap[userId] ?? 'none');

export const useConnectionLoading = (userId: string): boolean =>
  useConnectionStore((s) => s.loadingMap[userId] ?? false);

export const useConnection = () => {
  const { user } = useAuthh();
  const statusMap = useConnectionStore((s) => s.statusMap);
  const loadingMap = useConnectionStore((s) => s.loadingMap);

  useEffect(() => {
    if (!user?.id) return;
    useConnectionStore.getState().hydrate(user.id);
  }, [user?.id]);

  const setStatus = useCallback(
    (id: string, status: ConnectStatus) => {
      useConnectionStore.getState().setStatus(id, status, user?.id ?? null);
    },
    [user?.id],
  );

  const getStatus = (id: string): ConnectStatus => statusMap[id] ?? 'none';
  const isLoading = (id: string): boolean => loadingMap[id] ?? false;

  const sendRequest = useCallback(
    async (target: ConnectTarget) => {
      if (!user?.id) return;
      const tid = target.userId;
      const current = useConnectionStore.getState().statusMap[tid];
      if (current === 'pending' || current === 'accepted') return;

      setStatus(tid, 'pending');
      useConnectionStore.getState().setLoading(tid, true);
      try {
        const result = await callFn({ action: 'send_request', receiverId: tid });
        if (result?.connectionId) {
          const raw = await cacheGet(CACHE_KEY(user.id));
          const cache = raw ? JSON.parse(raw) : {};
          cache[`conn_${tid}`] = result.connectionId;
          cacheSet(CACHE_KEY(user.id), JSON.stringify(cache));
        }
      } catch (e: any) {
        if (e?.alreadyExists || e?.statusCode === 409) {
          const correctStatus = (e?.existingStatus as ConnectStatus) ?? 'pending';
          setStatus(tid, correctStatus);
          if (e?.connectionId) {
            const raw = await cacheGet(CACHE_KEY(user.id));
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
        useConnectionStore.getState().setLoading(tid, false);
      }
    },
    [user?.id, setStatus],
  );

  const acceptRequest = useCallback(
    async (connectionId: string, notifId: string, fromUserId: string): Promise<string | null> => {
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
    },
    [user?.id, setStatus],
  );

  const rejectRequest = useCallback(
    async (connectionId: string, notifId: string, fromUserId: string) => {
      if (!user?.id) return;
      setStatus(fromUserId, 'none');
      try {
        await callFn({ action: 'reject_request', connectionId, notifId });
      } catch (e: any) {
        console.warn(' rejectRequest:', e?.message);
        setStatus(fromUserId, 'pending');
      }
    },
    [user?.id, setStatus],
  );

  const cancelRequest = useCallback(
    async (targetId: string) => {
      if (!user?.id) return;
      const current = useConnectionStore.getState().statusMap[targetId];
      if (current !== 'pending') return;
      setStatus(targetId, 'none');
      try {
        const raw = await cacheGet(CACHE_KEY(user.id));
        const connId = raw ? JSON.parse(raw)[`conn_${targetId}`] : null;
        if (connId) await callFn({ action: 'cancel_request', connectionId: connId });
      } catch (e: any) {
        console.warn(' cancelRequest failed, reverting status:', e?.message);
        setStatus(targetId, 'pending');
      }
    },
    [user?.id, setStatus],
  );

  const loadStatuses = useCallback(
    async (userIds: string[]) => {
      if (!user?.id || !userIds.length) return;
      try {
        const [{ data: sent }, { data: recv }] = await Promise.all([
          supabase.from('connections').select('receiver_id, status, id')
            .eq('sender_id', user.id).in('receiver_id', userIds),
          supabase.from('connections').select('sender_id, status, id')
            .eq('receiver_id', user.id).in('sender_id', userIds),
        ]);
        const fresh: Record<string, ConnectStatus> = {};
        userIds.forEach((uid) => { fresh[uid] = 'none'; });
        (sent ?? []).forEach((d: any) => { fresh[d.receiver_id] = d.status as ConnectStatus; });
        (recv ?? []).forEach((d: any) => {
          if (fresh[d.sender_id] === 'none') fresh[d.sender_id] = d.status as ConnectStatus;
        });
        useConnectionStore.getState().mergeStatuses(fresh, user.id);
      } catch {}
    },
    [user?.id],
  );

  const clearStatuses = useCallback(() => {
    if (!user?.id) return;
    useConnectionStore.getState().reset();
    cacheDel(CACHE_KEY(user.id));
  }, [user?.id]);

  return {
    getStatus, isLoading, setStatus,
    sendRequest, acceptRequest, rejectRequest,
    cancelRequest, loadStatuses, clearStatuses,
  };
};