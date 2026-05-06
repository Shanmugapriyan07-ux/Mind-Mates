// hooks/useChat.ts
//
// ARCHITECTURE: Soft-delete chat system
//   hidden_for[]  on chats    → per-user list visibility only
//   deleted_for[] on messages → per-user message visibility
//
// KEY DESIGN: hidden_for is an APP-LEVEL filter, not an RLS filter.
//   RLS allows any participant to SELECT the chat row always.
//   This means findChat() always works even for hidden chats.
//   The hidden_for filter is only applied in the chat LIST query.

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, TABLES } from '@/lib/supabase';
import { callFn }           from '@/lib/callFn';
import { useAuthh }          from '@/Contexts/authContext';

// ── Types ──────────────────────────────────────────────────────────
export interface ChatMessage {
  $id:            string;
  chatId:         string;
  senderId:       string;
  message:        string;
  type:           string;
  status:         'sent' | 'seen';
  reactions:      string;
  replyToId?:     string;
  replyToText?:   string;
  replyToSender?: string;
  edited?:        boolean;
  createdAt:      number;
  deletedFor:     string[];
  _pending?:      boolean;
  _failed?:       boolean;
}

export interface ActionMessage {
  $id:        string;
  sender_id:  string;
  message:    string;
  created_at: number;
}

const rowToMsg = (r: any): ChatMessage => ({
  $id:           r.id,
  chatId:        r.chat_id,
  senderId:      r.sender_id,
  message:       r.message,
  type:          r.type           ?? 'text',
  status:        r.status         ?? 'sent',
  reactions:     r.reactions      ?? '[]',
  replyToId:     r.reply_to_id,
  replyToText:   r.reply_to_text,
  replyToSender: r.reply_to_sender,
  edited:        r.edited         ?? false,
  createdAt:     r.created_at,
  deletedFor:    r.deleted_for    ?? [],
});

const MSG_COLS = [
  'id','chat_id','sender_id','message','type','status',
  'reactions','reply_to_id','reply_to_text','reply_to_sender',
  'edited','created_at','deleted_for',
].join(',');

// ── findChat ────────────────────────────────────────────────────────
// Finds chat by chat_key regardless of hidden_for.
// Works because RLS chat_select only checks participants[], not hidden_for[].
// This is intentional — a hidden chat must still be findable so it can
// reappear when the user navigates back to it or a new message arrives.
export const findChat = async (myId: string, otherId: string) => {
  const chatKey = [myId, otherId].sort().join('_');
  const { data } = await supabase
    .from(TABLES.chats)
    .select('id')                 // RLS: participant check only, no hidden_for filter ✅
    .eq('chat_key', chatKey)
    .maybeSingle();
  return data ? { $id: data.id, ...data } : null;
};

// ── getChatId (edge fn fallback) ────────────────────────────────────
// Use when findChat returns null (should not happen with fixed RLS,
// but kept as a safety net for edge cases).
export const getChatId = async (otherUserId: string): Promise<string | null> => {
  try {
    const result = await callFn({ action: 'get_chat_id', otherUserId });
    return result?.chatId ?? null;
  } catch {
    return null;
  }
};

// ── Retry helper ────────────────────────────────────────────────────
const withRetry = async <T>(fn: () => Promise<T>, tries = 3): Promise<T> => {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise(r => setTimeout(r, 300 * 2 ** i));
    }
  }
  throw last;
};

// ── useMessages ─────────────────────────────────────────────────────
export const useMessages = (chatId: string) => {
  const { user }                     = useAuthh();
  const [messages,    setMessages]   = useState<ChatMessage[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [loadingOld,  setLoadingOld] = useState(false);
  const [hasMore,     setHasMore]    = useState(false);
  const oldestRef                    = useRef<number | null>(null);
  const channelRef                   = useRef<any>(null);

  const loadMessages = useCallback(async () => {
    if (!chatId || !user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await withRetry(async () =>
        supabase.from(TABLES.messages)
          .select(MSG_COLS)
          .eq('chat_id', chatId)
          // App-level soft-delete filter: rows where I'm in deleted_for are excluded.
          // RLS also enforces this server-side for security.
          .not('deleted_for', 'cs', `{${user.id}}`)
          .order('created_at', { ascending: false } as any)
          .limit(30)
      );
      if (error) throw error;
      const msgs = (data ?? []).map(rowToMsg).reverse();
      setMessages(msgs);
      setHasMore((data?.length ?? 0) === 30);
      if (msgs.length) oldestRef.current = msgs[0].createdAt;
    } catch (e: any) {
      console.error('[useMessages] load failed:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [chatId, user?.id]);

  const loadOlderMessages = useCallback(async () => {
    if (!chatId || !oldestRef.current || loadingOld || !user?.id) return;
    setLoadingOld(true);
    try {
      const { data } = await withRetry(async () =>
        supabase.from(TABLES.messages)
          .select(MSG_COLS)
          .eq('chat_id', chatId)
          .not('deleted_for', 'cs', `{${user.id}}`)
          .lt('created_at', oldestRef.current!)
          .order('created_at', { ascending: false } as any)
          .limit(30)
      );
      const older = (data ?? []).map(rowToMsg).reverse();
      setMessages(prev => [...older, ...prev]);
      setHasMore((data?.length ?? 0) === 30);
      if (older.length) oldestRef.current = older[0].createdAt;
    } finally {
      setLoadingOld(false);
    }
  }, [chatId, loadingOld, user?.id]);

  // ── Realtime subscription ───────────────────────────────────────
  // RULES (prevent all known crashes):
  //   1. Unique topic: `msg-${chatId}-${Date.now()}`
  //      → React Strict Mode runs effects twice. Same name returns cached
  //        subscribed instance → .on() crashes. Unique name = new instance always.
  //   2. ALL .on() before .subscribe() — Supabase requires this order.
  //   3. Cleanup by reference, not by name.
  //   4. Deps = [chatId, user?.id] only — adding callbacks causes extra runs.
  //   5. On CHANNEL_ERROR/TIMED_OUT: re-fetch as fallback.
  useEffect(() => {
    if (!chatId || !user?.id) return;
    const uid = user.id;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    loadMessages();

    const topic   = `msg-${chatId}-${Date.now()}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: TABLES.messages, filter: `chat_id=eq.${chatId}` },
        (payload: any) => {
          const { eventType, new: n, old: o } = payload;

          if (eventType === 'INSERT') {
            const msg = rowToMsg(n);
            if (msg.deletedFor.includes(uid)) return;
            setMessages(prev => {
              if (prev.some(m => m.$id === msg.$id)) return prev;
              const base = prev.filter(m => !(m._pending && m.message === msg.message));
              return [...base, msg];
            });
          }

          if (eventType === 'UPDATE') {
            const msg = rowToMsg(n);
            if (msg.deletedFor.includes(uid)) {
              setMessages(prev => prev.filter(m => m.$id !== msg.$id));
            } else {
              setMessages(prev => prev.map(m => m.$id === msg.$id ? msg : m));
            }
          }

          if (eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.$id !== o.id));
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] ${status} — reloading messages`);
          loadMessages();
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [chatId, user?.id]);

  // ── Send ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (
    text: string,
    opts?: { replyToId?: string|null; replyToText?: string|null; replyToSender?: string|null }
  ) => {
    if (!chatId || !user?.id || !text.trim()) return;
    const tempId = `tmp_${Date.now()}`;

    setMessages(prev => [...prev, {
      $id: tempId, chatId, senderId: user.id, message: text,
      type: 'text', status: 'sent', reactions: '[]',
      createdAt: Math.floor(Date.now() / 1000),
      deletedFor: [], _pending: true,
      replyToId:     opts?.replyToId     ?? undefined,
      replyToText:   opts?.replyToText   ?? undefined,
      replyToSender: opts?.replyToSender ?? undefined,
    }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
console.log('🔑 Session exists:', !!session);
console.log('🔑 Access token:', session?.access_token?.slice(0, 20));
console.log('📦 Payload:', JSON.stringify({ 
  action: 'send_message', 
  chatId, 
  message: text.slice(0, 20) 
}));



      // send_message edge fn also clears hidden_for=[] so chat reappears ✅
      await callFn({
        action: 'send_message', chatId, message: text,
        replyToId:     opts?.replyToId     ?? null,
        replyToText:   opts?.replyToText   ?? null,
        replyToSender: opts?.replyToSender ?? null,
      });
    } catch (e: any) {
      console.error('[sendMessage] failed:', e?.message);
      setMessages(prev => prev.map(m =>
        m.$id === tempId ? { ...m, _pending: false, _failed: true } : m
      ));
    }
  }, [chatId, user?.id]);

  const retryMessage = useCallback(async (msg: ChatMessage) => {
    setMessages(prev => prev.filter(m => m.$id !== msg.$id));
    await sendMessage(msg.message);
  }, [sendMessage]);

  return {
    messages, setMessages, loading, loadingOld, hasMore,
    sendMessage, retryMessage, loadOlderMessages,
  };
};

export default useMessages;