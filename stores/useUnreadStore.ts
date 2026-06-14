import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const unreadStorage = createJSONStorage(() => {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    return {
      getItem: async (name: string) => Promise.resolve(localStorage.getItem(name)),
      setItem: async (name: string, value: string) => Promise.resolve(localStorage.setItem(name, value)),
      removeItem: async (name: string) => Promise.resolve(localStorage.removeItem(name)),
    };
  }
  const AS = require('@react-native-async-storage/async-storage').default;
  return AS;
});
export interface UnreadState {
  chatUnread:    number;
  notifUnread:   number;
  totalUnread:   number; 
  perChatUnread: Record<string, number>;
  setAllCounts: (
    chat:     number,
    notif:    number,
    perChat?: Record<string, number>
  ) => void;
  clearChatBadge: (chatId: string) => void;
  clearNotifBadge: () => void;
  resetAll: () => void;
}
export const useUnreadStore = create<UnreadState>()(
  persist(
    (set: any, get: any) => ({
      chatUnread:    0,
      notifUnread:   0,
      totalUnread:   0,
      perChatUnread: {},
      setAllCounts: (chat: number, notif: number, perChat?: Record<string, number>) => {
        const prev = get();
        const newTotal = chat + notif;
        if (
          prev.chatUnread  === chat  &&
          prev.notifUnread === notif &&
          prev.totalUnread === newTotal
        ) return;
        set({
          chatUnread:    chat,
          notifUnread:   notif,
          totalUnread:   newTotal,
          perChatUnread: perChat ?? prev.perChatUnread,
        });
      },
      clearChatBadge: (chatId: string) => {
        const prev = get();
        const cleared = prev.perChatUnread[chatId] ?? 0;
        if (cleared === 0) return;
        const newPerChat = { ...prev.perChatUnread, [chatId]: 0 };
        const newChat    = Math.max(0, prev.chatUnread - cleared);
        const newTotal   = newChat + prev.notifUnread;
        set({
          perChatUnread: newPerChat,
          chatUnread:    newChat,
          totalUnread:   newTotal,
        });
      },
      clearNotifBadge: () => {
        const prev = get();
        if (prev.notifUnread === 0) return;
        set({
          notifUnread: 0,
          totalUnread: prev.chatUnread,
        });
      },
      resetAll: () => set({
        chatUnread:    0,
        notifUnread:   0,
        totalUnread:   0,
        perChatUnread: {},
      }),
    }),
    {
      name:    'mm_unread_store',         
      storage: unreadStorage,
      partialize: (s: UnreadState) => ({
        chatUnread:    s.chatUnread,
        notifUnread:   s.notifUnread,
        totalUnread:   s.totalUnread,
        perChatUnread: s.perChatUnread,
      }),
    }
  )
);
export const selectTotalUnread   = (s: UnreadState) => s.totalUnread;
export const selectChatUnread    = (s: UnreadState) => s.chatUnread;
export const selectNotifUnread   = (s: UnreadState) => s.notifUnread;
export const selectPerChatUnread = (s: UnreadState) => s.perChatUnread;
