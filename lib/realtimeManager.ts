// lib/RealtimeManager.ts
import { supabase }     from '@/lib/supabase';
import { useChatStore } from '@/stores/chatStore';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * One singleton that owns ALL realtime subscriptions for the logged-in user.
 * Prevents duplicate channels, memory leaks, and stale listeners.
 */
class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private userId: string | null = null;

  init(userId: string) {
    if (this.userId === userId) return;
    this.destroy();
    this.userId = userId;
    this.subscribeToConversationMembers(userId);
    this.subscribeToChats(userId);
  }

  destroy() {
    this.channels.forEach(ch => supabase.removeChannel(ch));
    this.channels.clear();
    this.userId = null;
  }

  // ─── Subscribe to conversation_members for this user ─────────────────────
  // This fires whenever unread_count changes (via the Postgres trigger).
  private subscribeToConversationMembers(userId: string) {
    const key = `conv_members:${userId}`;
    if (this.channels.has(key)) return;

    const channel = supabase
      .channel(key)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'conversation_members',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { chat_id: string; unread_count: number };
          useChatStore.getState().upsertConversation({
            chatId:      row.chat_id,
            unreadCount: row.unread_count,
          });
        }
      )
      .subscribe();

    this.channels.set(key, channel);
  }

  // ─── Subscribe to chats table for last_message preview updates ───────────
  private subscribeToChats(userId: string) {
    const key = `chats_preview:${userId}`;
    if (this.channels.has(key)) return;

    const channel = supabase
      .channel(key)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'chats',
        },
        (payload) => {
          const row = payload.new as {
            id: string; last_message: string;
            last_message_at: string; last_message_type: string;
          };
          useChatStore.getState().upsertConversation({
            chatId:          row.id,
            lastMessage:     row.last_message,
            lastMessageAt:   row.last_message_at,
            lastMessageType: row.last_message_type,
          });
        }
      )
      .subscribe();

    this.channels.set(key, channel);
  }

  // ─── Per-chat message channel (call from ChatScreen) ─────────────────────
  subscribeToMessages(
    chatId: string,
    onMessage: (msg: any) => void
  ): () => void {
    const key = `messages:${chatId}`;

    // Reuse existing if already subscribed
    if (this.channels.has(key)) {
      return () => this.unsubscribeChat(chatId);
    }

    const channel = supabase
      .channel(key)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => onMessage(payload.new)
      )
      .subscribe();

    this.channels.set(key, channel);
    return () => this.unsubscribeChat(chatId);
  }

  unsubscribeChat(chatId: string) {
    const key = `messages:${chatId}`;
    const ch  = this.channels.get(key);
    if (ch) {
      supabase.removeChannel(ch);
      this.channels.delete(key);
    }
  }
}

export const realtimeManager = new RealtimeManager();