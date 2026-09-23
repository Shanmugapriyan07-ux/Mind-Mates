import { callFn } from '@/lib/callFn';
import { supabase } from '@/lib/supabase';
import { useUnreadStore } from '@/stores/useUnreadStore';
import { AppState, AppStateStatus } from 'react-native';
import {
  initBadgeService,
  updateAppIconBadge,
  updateAppIconBadgeImmediate,
} from './badgeService';
interface UnreadCounts {
  chatUnread:    number;
  notifUnread:   number;
  perChatUnread: Record<string, number>;
}
let activeUserId:      string | null         = null;
let messageChannel:    any                   = null;
let notifChannel:      any                   = null;
let appStateSubscription: any                = null;
let isSyncing:         boolean               = false; 
export const initSyncService = async (userId: string): Promise<void> => {
  if (activeUserId === userId) return;
  await destroySyncService();
  activeUserId = userId;
  await initBadgeService();
  await fetchAndApplyCounts(userId);
  subscribeToMessages(userId);
  subscribeToNotifications(userId);
  setupAppStateListener(userId);
};
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
  await updateAppIconBadgeImmediate(0);
  useUnreadStore.getState().resetAll();
};
const fetchAndApplyCounts = async (userId: string): Promise<void> => {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const counts = await fetchUnreadCounts(userId);
    applyCountsToStore(counts);
    updateAppIconBadge(counts.chatUnread + counts.notifUnread);
  } catch (e) {
    console.warn('[SyncService] fetchAndApplyCounts failed:', e);
  } finally {
    isSyncing = false;
  }
};

const fetchUnreadCounts = async (userId: string): Promise<UnreadCounts> => {
  const [chatsResult, notifResult] = await Promise.all([
    supabase
      .from('chats')
      .select('id, participants, unread_p1, unread_p2')
      .contains('participants', [userId]),
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false),
  ]);

  let chatUnread = 0;
  const perChatUnread: Record<string, number> = {};

  for (const row of chatsResult.data ?? []) {
    const parts = (row.participants as string[]) ?? [];
    const myIndex = parts.indexOf(userId);
    const count = myIndex === 0 ? (row.unread_p1 ?? 0) : myIndex === 1 ? (row.unread_p2 ?? 0) : 0;
    if (count > 0) {
      chatUnread += count;
      perChatUnread[row.id] = count;
    }
  }

  return {
    chatUnread,
    notifUnread: notifResult.count ?? 0,
    perChatUnread,
  };
};
const applyCountsToStore = (counts: UnreadCounts): void => {
  useUnreadStore.getState().setAllCounts(
    counts.chatUnread,
    counts.notifUnread,
    counts.perChatUnread,
  );
};
const subscribeToMessages = (userId: string): void => {
  const topic = `sync_chats:${userId}:${Date.now()}`;
  messageChannel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chats', filter: `participant_1=eq.${userId}` },
      () => { if (activeUserId === userId) fetchAndApplyCounts(userId); },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chats', filter: `participant_2=eq.${userId}` },
      () => { if (activeUserId === userId) fetchAndApplyCounts(userId); },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[SyncService] Message channel error — will retry');
      }
    });
};const subscribeToNotifications = (userId: string): void => {
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
const setupAppStateListener = (userId: string): void => {
  let lastState = AppState.currentState;

  appStateSubscription = AppState.addEventListener(
    'change',
    async (nextState: AppStateStatus) => {
      const comingToForeground =
        (lastState === 'background' || lastState === 'inactive') &&
        nextState === 'active';

      if (comingToForeground && activeUserId === userId) {
        await fetchAndApplyCounts(userId);
      }

      lastState = nextState;
    }
  );
};
export const onChatOpened = async (chatId: string, userId: string): Promise<void> => {
  useUnreadStore.getState().clearChatBadge(chatId);
  await callFn({ action: 'mark_chat_read', chatId });
  await fetchAndApplyCounts(userId);
  const total = useUnreadStore.getState().totalUnread;
  await updateAppIconBadgeImmediate(total);
};
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
export const forceResync = async (): Promise<void> => {
  if (!activeUserId) return;
  isSyncing = false; 
  await fetchAndApplyCounts(activeUserId);
};