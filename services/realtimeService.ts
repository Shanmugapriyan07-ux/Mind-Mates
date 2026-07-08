import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type MessageHandler = (payload: any) => void;

class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();

  subscribeToChat(chatId: string, onMessage: MessageHandler): RealtimeChannel {
    const key = `chat:${chatId}`;
    if (this.channels.has(key)) return this.channels.get(key)!;

    const channel = supabase
      .channel(key)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        onMessage
      )
      .subscribe();

    this.channels.set(key, channel);
    return channel;
  }

  subscribeToConnections(userId: string, onChange: MessageHandler): RealtimeChannel {
    const key = `connections:${userId}`;
    if (this.channels.has(key)) return this.channels.get(key)!;

    const channel = supabase
      .channel(key)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `receiver_id=eq.${userId}`,
        },
        onChange
      )
      .subscribe();

    this.channels.set(key, channel);
    return channel;
  }

  unsubscribe(key: string) {
    const channel = this.channels.get(key);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(key);
    }
  }

  unsubscribeAll() {
    this.channels.forEach((channel) => supabase.removeChannel(channel));
    this.channels.clear();
  }
}

export const realtimeService = new RealtimeService();