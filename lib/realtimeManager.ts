// import { supabase } from '@/lib/supabase';
// import { useChatStore } from '@/stores/chatStore';
// import { RealtimeChannel } from '@supabase/supabase-js';
// class RealtimeManager {
//   private channels: Map<string, RealtimeChannel> = new Map();
//    private messageListeners: Map<string, Set<(msg: any) => void>> = new Map();
//   private userId: string | null = null;

//   init(userId: string) {
//     if (this.userId === userId) return;
//     this.destroy();
//     this.userId = userId;
//     this.subscribeToConversationMembers(userId);
//     this.subscribeToChats(userId);
//   }

//   destroy() {
//     this.channels.forEach(ch => supabase.removeChannel(ch));
//     this.channels.clear();
//     this.userId = null;
//   }
//   private subscribeToConversationMembers(userId: string) {
//     const key = `conv_members:${userId}`;
//     if (this.channels.has(key)) return;

//     const channel = supabase
//       .channel(key)
//       .on(
//         'postgres_changes',
//         {
//           event:  'UPDATE',
//           schema: 'public',
//           table:  'conversation_members',
//           filter: `user_id=eq.${userId}`,
//         },
//         (payload) => {
//           const row = payload.new as { chat_id: string; unread_count: number };
//           useChatStore.getState().upsertConversation({
//             chatId:      row.chat_id,
//             unreadCount: row.unread_count,
//           });
//         }
//       )
//       .subscribe();

//     this.channels.set(key, channel);
//   }
//   private subscribeToChats(userId: string) {
//   const key = `chats_preview:${userId}`;
//   if (this.channels.has(key)) return;
//   const channel = supabase
//     .channel(key)
//     .on(
//       'postgres_changes',
//       { event: 'UPDATE', schema: 'public', table: 'chats' },
//       (payload) => {
//         const row = payload.new as {
//           id: string; last_message: string;
//           last_message_at: string; last_message_type: string;
//         };
//         const known = useChatStore.getState().conversations?.some(
//           (c: any) => c.chatId === row.id
//         );
//         if (!known) return;

//         useChatStore.getState().upsertConversation({
//           chatId: row.id,
//           lastMessage: row.last_message,
//           lastMessageAt: row.last_message_at,
//           lastMessageType: row.last_message_type,
//         });
//       }
//     )
//     .subscribe();
//   this.channels.set(key, channel);
// }
//   subscribeToMessages(chatId: string, onMessage: (msg: any) => void): () => void {
//     const key = `messages:${chatId}`;

//     if (!this.messageListeners.has(key)) {
//       this.messageListeners.set(key, new Set());
//     }
//     this.messageListeners.get(key)!.add(onMessage);

//     if (!this.channels.has(key)) {
//       const channel = supabase
//         .channel(key)
//         .on(
//           'postgres_changes',
//           { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
//           (payload) => {
//             this.messageListeners.get(key)?.forEach((cb) => cb(payload.new));
//           },
//         )
//         .subscribe();
//       this.channels.set(key, channel);
//     }

//     return () => {
//       const listeners = this.messageListeners.get(key);
//       listeners?.delete(onMessage);
//       if (!listeners || listeners.size === 0) {
//         this.unsubscribeChat(chatId);
//         this.messageListeners.delete(key);
//       }
//     };
//   }

//   unsubscribeChat(chatId: string) {
//     const key = `messages:${chatId}`;
//     const ch = this.channels.get(key);
//     if (ch) {
//       supabase.removeChannel(ch);
//       this.channels.delete(key);
//     }
//   }
// }
// export const realtimeManager = new RealtimeManager();