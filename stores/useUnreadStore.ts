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

// ── Types ─────────────────────────────────────────────────────────
export interface UnreadState {
  // Aggregate counts
  chatUnread:    number;
  notifUnread:   number;
  totalUnread:   number; 
  perChatUnread: Record<string, number>;

  setAllCounts: (
    chat:     number,
    notif:    number,
    perChat?: Record<string, number>
  ) => void;

  // Called when a specific chat is opened → clears that chat's dot
  clearChatBadge: (chatId: string) => void;

  // Called when notification screen is opened
  clearNotifBadge: () => void;

  // Reset everything (on sign-out)
  resetAll: () => void;
}

// ── Store ─────────────────────────────────────────────────────────
export const useUnreadStore = create<UnreadState>()(
  persist(
    (set: any, get: any) => ({
      chatUnread:    0,
      notifUnread:   0,
      totalUnread:   0,
      perChatUnread: {},

      // ── Set all counts from backend (primary update path) ─────
      // This is the ONLY place we write counts — always from backend query.
      // Never increment/decrement blindly — always replace with backend value.
      setAllCounts: (chat: number, notif: number, perChat?: Record<string, number>) => {
        const prev = get();

        // Bail if nothing changed — prevents unnecessary re-renders + badge writes
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

      // ── Clear a specific chat's badge (user opened that chat) ──
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

      // ── Clear notification badge (user opened notif screen) ───
      clearNotifBadge: () => {
        const prev = get();
        if (prev.notifUnread === 0) return;
        set({
          notifUnread: 0,
          totalUnread: prev.chatUnread,
        });
      },

      // ── Full reset on sign-out ─────────────────────────────────
      resetAll: () => set({
        chatUnread:    0,
        notifUnread:   0,
        totalUnread:   0,
        perChatUnread: {},
      }),
    }),
    {
      name:    'mm_unread_store',           // AsyncStorage key
      storage: unreadStorage,
      // Only persist the counts — not the action functions
      partialize: (s: UnreadState) => ({
        chatUnread:    s.chatUnread,
        notifUnread:   s.notifUnread,
        totalUnread:   s.totalUnread,
        perChatUnread: s.perChatUnread,
      }),
    }
  )
);

// ── Pre-built selectors (stable references, safe for useCallback deps) ──
export const selectTotalUnread   = (s: UnreadState) => s.totalUnread;
export const selectChatUnread    = (s: UnreadState) => s.chatUnread;
export const selectNotifUnread   = (s: UnreadState) => s.notifUnread;
export const selectPerChatUnread = (s: UnreadState) => s.perChatUnread;

// Usage:
//   const total = useUnreadStore(selectTotalUnread);
//   const dot   = useUnreadStore(s => s.perChatUnread[chatId] ?? 0);