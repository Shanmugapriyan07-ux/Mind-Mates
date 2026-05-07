
import { AppState, AppStateStatus } from 'react-native';
import { supabase }                 from '@/lib/supabase';
import { useUnreadStore }           from '@/stores/useUnreadStore';
import {
  updateAppIconBadge,
  updateAppIconBadgeImmediate,
  initBadgeService,
} from './badgeService';

// ── Types ─────────────────────────────────────────────────────────
interface UnreadCounts {
  chatUnread:    number;
  notifUnread:   number;
  perChatUnread: Record<string, number>;
}

// ── Internal state (module-level, not React state) ────────────────
let activeUserId:      string | null         = null;
let messageChannel:    any                   = null;
let notifChannel:      any                   = null;
let appStateSubscription: any                = null;
let isSyncing:         boolean               = false;  // prevents parallel fetches

// ── Initialize (call once after user logs in) ─────────────────────
export const initSyncService = async (userId: string): Promise<void> => {
  if (activeUserId === userId) return;  // already initialized for this user

  // Clean up previous session first (e.g. user switched accounts)
  await destroySyncService();

  activeUserId = userId;
  await initBadgeService();

  // Initial fetch — shows correct count before any realtime events arrive
  await fetchAndApplyCounts(userId);

  // Subscribe to realtime changes
  subscribeToMessages(userId);
  subscribeToNotifications(userId);

  // Handle foreground/background transitions
  setupAppStateListener(userId);
};

// ── Destroy (call on sign-out) ────────────────────────────────────
export const destroySyncService = async (): Promise<void> => {
  if (messageChannel) {
    await supabase.removeChannel(messageChannel);
    messageChannel = null;
  }
  if (notifChannel) {
    await supabase.removeChannel(notifChannel);
    notifChannel = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  activeUserId = null;
  isSyncing    = false;

  // Clear badge + store on sign-out
  await updateAppIconBadgeImmediate(0);
  useUnreadStore.getState().resetAll();
};

// ══════════════════════════════════════════════════════════════════
// BACKEND FETCH
// ══════════════════════════════════════════════════════════════════

const fetchAndApplyCounts = async (userId: string): Promise<void> => {
  // Guard: prevent parallel fetches (realtime event storms)
  if (isSyncing) return;
  isSyncing = true;

  try {
    const counts = await fetchUnreadCounts(userId);
    applyCountsToStore(counts);
    updateAppIconBadge(counts.chatUnread + counts.notifUnread);
  } catch (e) {
    console.warn('[SyncService] fetchAndApplyCounts failed:', e);
    // Non-fatal — last known count stays in store + badge
  } finally {
    isSyncing = false;
  }
};

// ── Supabase queries ──────────────────────────────────────────────
const fetchUnreadCounts = async (userId: string): Promise<UnreadCounts> => {
  // Run both queries in parallel — total time = slowest query (~30ms)
  const [chatResult, notifResult, perChatResult] = await Promise.all([

    // Total unread messages
    supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })  // head=true: no rows returned, just count
      .eq('receiver_id', userId)
      .eq('is_read', false),

    // Total unread notifications
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false),

    // Per-chat breakdown (for individual chat row dots)
    // Limit 50 — we only need dots for active chats
    supabase
      .from('messages')
      .select('chat_id')
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .limit(200),

  ]);

  // Build per-chat map from flat rows
  const perChatUnread: Record<string, number> = {};
  if (perChatResult.data) {
    for (const row of perChatResult.data) {
      perChatUnread[row.chat_id] = (perChatUnread[row.chat_id] ?? 0) + 1;
    }
  }

  return {
    chatUnread:  chatResult.count  ?? 0,
    notifUnread: notifResult.count ?? 0,
    perChatUnread,
  };
};

// ── Apply to Zustand store ────────────────────────────────────────
const applyCountsToStore = (counts: UnreadCounts): void => {
  useUnreadStore.getState().setAllCounts(
    counts.chatUnread,
    counts.notifUnread,
    counts.perChatUnread,
  );
};

// ══════════════════════════════════════════════════════════════════
// REALTIME SUBSCRIPTIONS
// ══════════════════════════════════════════════════════════════════

// ── Message subscription ──────────────────────────────────────────
// Single channel for ALL of this user's messages.
// One channel = one WebSocket multiplexed connection.
// Supabase RLS ensures only this user's data is returned.
const subscribeToMessages = (userId: string): void => {
  // Unique channel name prevents "already subscribed" errors on re-init
  const topic = `messages:${userId}:${Date.now()}`;

  messageChannel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event:  '*',                  // INSERT (new msg) + UPDATE (marked read)
        schema: 'public',
        table:  'messages',
        filter: `receiver_id=eq.${userId}`,
      },
      (_payload) => {
        // Always re-fetch from backend — never trust the payload count
        // Payload tells us WHAT changed; backend tells us THE TRUE COUNT
        if (activeUserId === userId) {
          fetchAndApplyCounts(userId);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[SyncService] Message channel subscribed');
      }
      if (status === 'CHANNEL_ERROR') {
        console.warn('[SyncService] Message channel error — will retry');
        // Supabase client auto-retries on disconnect
      }
    });
};

// ── Notification subscription ─────────────────────────────────────
const subscribeToNotifications = (userId: string): void => {
  const topic = `notifications:${userId}:${Date.now()}`;

  notifChannel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (_payload) => {
        if (activeUserId === userId) {
          fetchAndApplyCounts(userId);
        }
      }
    )
    .subscribe();
};

// ══════════════════════════════════════════════════════════════════
// APP STATE LISTENER
// ══════════════════════════════════════════════════════════════════
//
// WHY THIS IS CRITICAL:
//   Supabase Realtime WebSocket disconnects when app goes to background.
//   While background: push notifications update the badge externally.
//   When app returns to foreground: we re-fetch from backend to catch
//   any missed events (messages received while WebSocket was dead).
//
//   Without this: user receives 5 messages while background,
//   opens app, WebSocket reconnects, but store still shows old count.
//   WITH this: app opens → immediate fresh fetch → store + badge correct.

const setupAppStateListener = (userId: string): void => {
  let lastState = AppState.currentState;

  appStateSubscription = AppState.addEventListener(
    'change',
    async (nextState: AppStateStatus) => {
      const comingToForeground =
        (lastState === 'background' || lastState === 'inactive') &&
        nextState === 'active';

      if (comingToForeground && activeUserId === userId) {
        console.log('[SyncService] App foregrounded — re-syncing counts');
        await fetchAndApplyCounts(userId);
      }

      lastState = nextState;
    }
  );
};

// ══════════════════════════════════════════════════════════════════
// PUBLIC API — for use in screen components
// ══════════════════════════════════════════════════════════════════

// Call when user opens a specific chat screen
export const onChatOpened = async (chatId: string, userId: string): Promise<void> => {
  // Optimistic local clear (instant UI response)
  useUnreadStore.getState().clearChatBadge(chatId);

  // Mark as read in backend (triggers realtime → fresh count → badge update)
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('chat_id', chatId)
    .eq('receiver_id', userId)
    .eq('is_read', false);

  // Immediate badge re-sync after marking read
  await fetchAndApplyCounts(userId);
  const total = useUnreadStore.getState().totalUnread;
  await updateAppIconBadgeImmediate(total);
};

// Call when user opens the notifications screen
export const onNotifScreenOpened = async (userId: string): Promise<void> => {
  useUnreadStore.getState().clearNotifBadge();

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  await fetchAndApplyCounts(userId);
  const total = useUnreadStore.getState().totalUnread;
  await updateAppIconBadgeImmediate(total);
};

// Force a full re-sync (call from pull-to-refresh or error recovery)
export const forceResync = async (): Promise<void> => {
  if (!activeUserId) return;
  isSyncing = false;  // override guard for force sync
  await fetchAndApplyCounts(activeUserId);
};