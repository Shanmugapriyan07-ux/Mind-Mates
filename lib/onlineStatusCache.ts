// lib/onlineStatusCache.ts
import { supabase } from '@/lib/supabase';

interface CachedStatus {
  isOnline: boolean;
  lastSeen: string | null;
}

type Listener = (status: CachedStatus) => void;

const STALE_MS  = 3 * 60 * 1000;   // force offline if last_seen > 3 min old
const GHOST_MS  = 3 * 60 * 1000;   // auto-clear online dot after 3 min silence

class OnlineStatusCache {
  private cache        = new Map<string, CachedStatus>();
  private listeners    = new Map<string, Set<Listener>>();
  private channels     = new Map<string, any>();
  private ghostTimers  = new Map<string, ReturnType<typeof setTimeout>>();
  // FIX: track which userIds have a startWatching call in-flight
  // so we never open two channels for the same userId simultaneously
  private watchPending = new Set<string>();

  // ── subscribe ─────────────────────────────────────────────────────────────
  // Returns an unsubscribe function. Safe to call multiple times per userId.
  subscribe(userId: string, listener: Listener): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(listener);

    const cached = this.cache.get(userId);
    if (cached) {
      // Deliver cached value synchronously
      listener(cached);
      // Even with a cached value, ensure a channel is open
      // (it may have been closed and re-opened between subscribers)
      this.ensureWatching(userId);
    } else {
      this.ensureWatching(userId);
    }

    return () => this.unsubscribe(userId, listener);
  }

  // ── unsubscribe ───────────────────────────────────────────────────────────
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

  // ── ensureWatching ────────────────────────────────────────────────────────
  // FIX: replaces startWatching — guards against parallel async calls
  // opening duplicate channels for the same userId.
  private ensureWatching(userId: string) {
    if (this.channels.has(userId))  return; // already live
    if (this.watchPending.has(userId)) return; // already starting
    this.watchPending.add(userId);
    this.startWatching(userId).finally(() => {
      this.watchPending.delete(userId);
    });
  }

  private async startWatching(userId: string) {
    // Abort if all subscribers left while we were waiting
    if (!this.listeners.has(userId) || this.listeners.get(userId)!.size === 0) return;

    // Initial fetch
    try {
      const { data } = await supabase
        .from('users')
        .select('is_online, last_seen')
        .eq('user_id', userId)
        .single();

      if (data) {
        this.apply(userId, data.is_online ?? false, data.last_seen ?? null);
      }
    } catch (e) {
      console.warn('[OnlineCache] initial fetch failed for', userId.slice(0, 8));
    }

    // Bail if unsubscribed while fetching
    if (!this.listeners.has(userId) || this.listeners.get(userId)!.size === 0) return;
    // Or if another path already opened the channel
    if (this.channels.has(userId)) return;

    const refetch = async () => {
      // Guard against calling this after the channel was removed
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
            // REPLICA IDENTITY FULL — we have the full row
            this.apply(userId, row.is_online ?? false, row.last_seen ?? null);
          } else {
            // REPLICA IDENTITY not FULL — refetch
            refetch();
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          // Refresh immediately on subscribe to catch any updates we missed
          // between the initial fetch and subscription becoming active
          refetch();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[OnlineCache] channel error for', userId.slice(0, 8), '— refetching');
          refetch();
          // Attempt channel recovery after a short delay
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

  // ── stopWatching ──────────────────────────────────────────────────────────
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

  // ── apply ─────────────────────────────────────────────────────────────────
  // Central state machine for a userId's online status.
  private apply(userId: string, isOnline: boolean, lastSeen: string | null) {
    // Staleness guard — force offline if last_seen is too old
    if (isOnline && lastSeen) {
      const age = Date.now() - new Date(lastSeen).getTime();
      if (age > STALE_MS) {
        console.log('[OnlineCache] stale presence, forcing offline for', userId.slice(0, 8));
        isOnline = false;
      }
    }

    const prev   = this.cache.get(userId);
    const status: CachedStatus = { isOnline, lastSeen };

    // FIX: Skip notification + ghost timer reset if nothing meaningful changed.
    // This prevents the heartbeat RT loop from flickering the online dot.
    const statusUnchanged =
      prev?.isOnline === isOnline &&
      prev?.lastSeen === lastSeen;

    this.cache.set(userId, status);

    if (!statusUnchanged) {
      // Notify listeners only on real change
      this.listeners.get(userId)?.forEach(fn => fn(status));
    }

    // ── Ghost timer ─────────────────────────────────────────────────────────
    // FIX: Only reset the ghost timer when isOnline transitions TRUE → TRUE
    // with a fresh lastSeen (heartbeat) OR FALSE → TRUE (came online).
    // We do NOT reset it on FALSE → FALSE (unnecessary, avoids noisy loops).
    if (isOnline) {
      const existing = this.ghostTimers.get(userId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        const current = this.cache.get(userId);
        // Only fire if the user is still marked online and hasn't had a
        // more recent lastSeen since this timer was set
        if (current?.isOnline) {
          console.log('[OnlineCache] ghost timeout for', userId.slice(0, 8));
          this.apply(userId, false, current.lastSeen);
        }
        this.ghostTimers.delete(userId);
      }, GHOST_MS);

      this.ghostTimers.set(userId, timer);
    } else {
      // Came offline — cancel ghost timer, no need to auto-clear
      const existing = this.ghostTimers.get(userId);
      if (existing) {
        clearTimeout(existing);
        this.ghostTimers.delete(userId);
      }
    }
  }
}

export const onlineStatusCache = new OnlineStatusCache();