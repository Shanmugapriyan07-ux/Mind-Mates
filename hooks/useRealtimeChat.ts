// hooks/useRealtimeChat.ts
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { realtimeService } from '@/services/realtimeService';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export function useRealtimeChat(chatId: string, currentUserId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Initial fetch
    supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          data.forEach((m) => seenIds.current.add(m.id));
          setMessages(data);
        }
      });

    // Realtime subscription
    realtimeService.subscribeToChat(chatId, (payload) => {
      const msg: Message = payload.new;
      if (seenIds.current.has(msg.id)) return; // deduplicate
      seenIds.current.add(msg.id);
      setMessages((prev) => [...prev, msg]);
    });

    return () => realtimeService.unsubscribe(`chat:${chatId}`);
  }, [chatId]);

  const sendMessage = async (content: string) => {
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      chat_id: chatId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
    };

    // Optimistic insert
    seenIds.current.add(optimisticId);
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('messages')
      .insert({ chat_id: chatId, sender_id: currentUserId, content })
      .select()
      .single();

    if (error) {
      // Rollback optimistic
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      seenIds.current.delete(optimisticId);
    } else if (data) {
      // Replace optimistic with real
      seenIds.current.delete(optimisticId);
      seenIds.current.add(data.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? data : m))
      );
    }
  };

  return { messages, sendMessage };
}