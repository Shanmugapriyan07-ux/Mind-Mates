import { supabase } from '@/lib/supabase';
interface CachedStatus {
  isOnline: boolean;
  lastSeen: string | null;
}
type Listener = (status: CachedStatus) => void;
const STALE_MS  = 3 * 60 * 1000;   
const GHOST_MS  = 3 * 60 * 1000;  
class OnlineStatusCache {
  private cache        = new Map<string, CachedStatus>();
  private listeners    = new Map<string, Set<Listener>>();
  private channels     = new Map<string, any>();
  private ghostTimers  = new Map<string, ReturnType<typeof setTimeout>>();
  private watchPending = new Set<string>();
  subscribe(userId: string, listener: Listener): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(listener);

    const cached = this.cache.get(userId);
    if (cached) {
      listener(cached);
      this.ensureWatching(userId);
    } else {
      this.ensureWatching(userId);
    }
    return () => this.unsubscribe(userId, listener);
  }
  private unsubscribe(userId: string, listener: Listener) {
    const set = this.listeners.get(userId);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      this.stopWatching(userId);
      this.listeners.delete(userId);
      this.cache.delete(userId);
    }
  }
  private ensureWatching(userId: string) {
    if (this.channels.has(userId))  return; 
    if (this.watchPending.has(userId)) return; 
    this.watchPending.add(userId);
    this.startWatching(userId).finally(() => {
      this.watchPending.delete(userId);
    });
  }

  private async startWatching(userId: string) {
    if (!this.listeners.has(userId) || this.listeners.get(userId)!.size === 0) return;
    try {
      const { data } = await supabase
        .from('users')
        .select('is_online, last_seen')
        .eq('user_id', userId)
        .single();

      if (data) {
        this.apply(userId, data.is_online ?? false, data.last_seen ?? null);
      }
    } catch {
      console.warn('[OnlineCache] initial fetch failed for', userId.slice(0, 8));
    }
    if (!this.listeners.has(userId) || this.listeners.get(userId)!.size === 0) return;
    if (this.channels.has(userId)) return;

    const refetch = async () => {
      if (!this.listeners.has(userId)) return;
      try {
        const { data } = await supabase
          .from('users')
          .select('is_online, last_seen')
          .eq('user_id', userId)
          .single();
        if (data) {
          this.apply(userId, data.is_online ?? false, data.last_seen ?? null);
        }
      } catch {}
    };
    const channel = supabase
      .channel(`online_cache_${userId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'users',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const row = payload.new as {
            is_online?: boolean;
            last_seen?: string;
          } | null;

          if (row && row.last_seen !== undefined) {
            this.apply(userId, row.is_online ?? false, row.last_seen ?? null);
          } else {
            refetch();
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          refetch();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[OnlineCache] channel error for', userId.slice(0, 8), '— refetching');
          refetch();
          setTimeout(() => {
            if (this.listeners.has(userId) && this.listeners.get(userId)!.size > 0) {
              this.stopWatching(userId);
              this.ensureWatching(userId);
            }
          }, 3000);
        }
      });

    this.channels.set(userId, channel);
  }
  private stopWatching(userId: string) {
    const channel = this.channels.get(userId);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(userId);
    }
    const timer = this.ghostTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.ghostTimers.delete(userId);
    }
  }
  private apply(userId: string, isOnline: boolean, lastSeen: string | null) {
    if (isOnline && lastSeen) {
      const age = Date.now() - new Date(lastSeen).getTime();
      if (age > STALE_MS) {
        isOnline = false;
      }
    }
    const prev   = this.cache.get(userId);
    const status: CachedStatus = { isOnline, lastSeen };
    const statusUnchanged =
      prev?.isOnline === isOnline &&
      prev?.lastSeen === lastSeen;

    this.cache.set(userId, status);

    if (!statusUnchanged) {
      this.listeners.get(userId)?.forEach(fn => fn(status));
    }
    if (isOnline) {
      const existing = this.ghostTimers.get(userId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        const current = this.cache.get(userId);
        if (current?.isOnline) {
          this.apply(userId, false, current.lastSeen);
        }
        this.ghostTimers.delete(userId);
      }, GHOST_MS);

      this.ghostTimers.set(userId, timer);
    } else {
      const existing = this.ghostTimers.get(userId);
      if (existing) {
        clearTimeout(existing);
        this.ghostTimers.delete(userId);
      }
    }
  }
}
export const onlineStatusCache = new OnlineStatusCache();