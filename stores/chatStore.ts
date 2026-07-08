import { create } from 'zustand';
export interface ConversationMeta {
  chatId:          string;
  otherUserId:     string;
  otherName:       string;
  otherImage:      string | null;
  lastMessage:     string | null;
  lastMessageAt:   string | null;
  lastMessageType: string;
  unreadCount:     number;
  isOnline:        boolean;
  lastSeen:        string | null;
activeChatId: string | null;
setActiveChatId: (chatId: string | null) => void;
}

interface ChatStore {
  conversations:    ConversationMeta[];
  totalUnread:      number;
  setConversations: (c: ConversationMeta[]) => void;
  upsertConversation: (partial: Partial<ConversationMeta> & { chatId: string }) => void;
  markRead:         (chatId: string) => void;
  incrementUnread:  (chatId: string) => void;
 activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  totalUnread:   0,
  setConversations: (conversations) => {
    const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);
    set({ conversations, totalUnread });
  },

  upsertConversation: (partial) => {
    set(state => {
      const existing = state.conversations.find(c => c.chatId === partial.chatId);
      let next: ConversationMeta[];

      if (existing) {
        next = state.conversations
          .map(c => c.chatId === partial.chatId ? { ...c, ...partial } : c)
          .sort((a, b) =>
            new Date(b.lastMessageAt ?? 0).getTime() -
            new Date(a.lastMessageAt ?? 0).getTime()
          );
      } else {
        next = [partial as ConversationMeta, ...state.conversations];
      }

      return {
        conversations: next,
        totalUnread:   next.reduce((s, c) => s + c.unreadCount, 0),
      };
    });
  },

  markRead: (chatId) => {
    set(state => {
      const next = state.conversations.map(c =>
        c.chatId === chatId ? { ...c, unreadCount: 0 } : c
      );
      return {
        conversations: next,
        totalUnread:   next.reduce((s, c) => s + c.unreadCount, 0),
      };
    });
  },

  incrementUnread: (chatId) => {
    set(state => {
      const next = state.conversations.map(c =>
        c.chatId === chatId ? { ...c, unreadCount: c.unreadCount + 1 } : c
      );
      return {
        conversations: next,
        totalUnread:   next.reduce((s, c) => s + c.unreadCount, 0),
      };
    });
  },

  activeChatId: null,
  setActiveChatId: (id) => set({ activeChatId: id }),
}));