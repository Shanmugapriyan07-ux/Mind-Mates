import { useAuthh }           from '@/Contexts/authContext';
import { callFn }             from '@/lib/callFn';
import { supabase, TABLES }   from '@/lib/supabase';
import { useCallback, useEffect, useRef, useState } from 'react';
const secToMs = (ts: number) => (ts < 10_000_000_000 ? ts * 1000 : ts);
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
const MUTABLE_COLS = 'id,status,reactions,edited,message,deleted_for';
export const findChat = async (myId: string, otherId: string) => {
  const chatKey = [myId, otherId].sort().join('_');
  const { data } = await supabase
    .from(TABLES.chats).select('id').eq('chat_key', chatKey).maybeSingle();
  return data ? { $id: data.id, ...data } : null;
};
export const getChatId = async (otherUserId: string): Promise<string | null> => {
  try {
    const result = await callFn({ action: 'get_chat_id', otherUserId });
    return result?.chatId ?? null;
  } catch { return null; }
};
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
const pendingRegistry = new Map<string, string>();
const makePendingKey  = (chatId: string, senderId: string, message: string) =>
  `${chatId}|${senderId}|${message}`;
export const useMessages = (chatId: string) => {
  const { user } = useAuthh();
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingOld, setLoadingOld] = useState(false);
  const [hasMore,    setHasMore]    = useState(false);
  const oldestRef    = useRef<number | null>(null);
  const channelRef   = useRef<any>(null);
  const knownIdsRef  = useRef<Set<string>>(new Set());
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsSyncRef = useRef(false);
  const syncMutableFields = useCallback((uid: string, currentChatId: string) => {
    supabase
      .from(TABLES.messages)
      .select(MUTABLE_COLS)
      .eq('chat_id', currentChatId)
      .then(({ data: fresh }) => {
        if (!fresh?.length) return;
        const freshMap = new Map<string, any>(fresh.map((r: any) => [r.id, r]));
        setMessages(prev => {
          let dirty = false;
          const next = prev
            .map(m => {
              const f = freshMap.get(m.$id);
              if (!f) return m;
              if (f.deleted_for?.includes(uid)) {
                dirty = true;
                knownIdsRef.current.delete(m.$id);
                return null;
              }
              if (
                f.status    === m.status    &&
                f.reactions === m.reactions &&
                f.edited    === m.edited    &&
                f.message   === m.message   &&
                (f.deleted_for?.length ?? 0) === (m.deletedFor?.length ?? 0)
              ) return m;
              dirty = true;
              return {
                ...m,
                status:     f.status,
                reactions:  f.reactions   ?? '[]',
                edited:     f.edited      ?? false,
                message:    f.message,
                deletedFor: f.deleted_for ?? [],
              };
            })
            .filter(Boolean) as ChatMessage[];
          return dirty ? next : prev;
        });
      });
  }, []);
  const scheduleSyncMutableFields = useCallback((uid: string, currentChatId: string) => {
    needsSyncRef.current = true;
    if (syncTimerRef.current) return; // already scheduled
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      needsSyncRef.current = false;
      syncMutableFields(uid, currentChatId);
    }, 300);
  }, [syncMutableFields]);
  const loadMessages = useCallback(async () => {
    if (!chatId || !user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await withRetry<{ data: any[] | null; error: any }>(() =>
        supabase
          .from(TABLES.messages)
          .select(MSG_COLS)
          .eq('chat_id', chatId)
          .not('deleted_for', 'cs', `{${user.id}}`)
          .order('created_at', { ascending: false } as any)
          .limit(30) as any
      );
      if (error) throw error;
      const msgs = (data ?? []).map(rowToMsg).reverse();
      knownIdsRef.current = new Set(msgs.map(m => m.$id));

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
      const { data } = await withRetry<{ data: any[] | null }>(() =>
        supabase
          .from(TABLES.messages)
          .select(MSG_COLS)
          .eq('chat_id', chatId)
          .not('deleted_for', 'cs', `{${user.id}}`)
          .lt('created_at', oldestRef.current!)
          .order('created_at', { ascending: false })
          .limit(30) as any
      );
      const older = (data ?? []).map(rowToMsg).reverse();
      older.forEach(m => knownIdsRef.current.add(m.$id));

      setMessages(prev => [...older, ...prev]);
      setHasMore((data?.length ?? 0) === 30);
      if (older.length) oldestRef.current = older[0].createdAt;
    } finally {
      setLoadingOld(false);
    }
  }, [chatId, loadingOld, user?.id]);
  useEffect(() => {
    if (!chatId || !user?.id) return;
    const uid = user.id;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    loadMessages();
    const handlePayload = (payload: any) => {
      const { eventType, new: n, old: o } = payload;
      if (eventType === 'INSERT') {
        if (!n?.id) return;
        const msg = rowToMsg(n);
        if (msg.deletedFor?.includes(uid)) return;
        if (knownIdsRef.current.has(msg.$id)) {
          setMessages(prev => {
            const idx = prev.findIndex(m => m.$id === msg.$id && !m._pending);
            if (idx === -1) return prev;
            return prev;
          });
          return;
        }
        const pKey   = makePendingKey(msg.chatId, msg.senderId, msg.message);
        const tempId = pendingRegistry.get(pKey);
        setMessages(prev => {
          if (tempId) {
            pendingRegistry.delete(pKey);
            knownIdsRef.current.add(msg.$id);
            const idx = prev.findIndex(m => m.$id === tempId);
            if (idx !== -1) {
              const next  = [...prev];
              next[idx]   = { ...msg, _pending: false, _failed: false };
              return next;
            }
            if (prev.some(m => m.$id === msg.$id)) return prev;
            return [...prev, msg];
          }
          const pendingIdx = prev.findIndex(m =>
            m._pending &&
            m.message  === msg.message  &&
            m.senderId === msg.senderId &&
            Math.abs(secToMs(m.createdAt) - secToMs(msg.createdAt)) < 30_000
          );
          if (pendingIdx !== -1) {
            knownIdsRef.current.add(msg.$id);
            const next = [...prev];
            next[pendingIdx] = { ...msg, _pending: false, _failed: false };
            return next;
          }
          if (prev.some(m => m.$id === msg.$id)) return prev; 
          knownIdsRef.current.add(msg.$id);
          return [...prev, msg];
        });

        return;
      }
      if (eventType === 'UPDATE') {
        if (!n?.id) {
          scheduleSyncMutableFields(uid, chatId);
          return;
        }
        const msg = rowToMsg(n);
        if (msg.deletedFor?.includes(uid)) {
          knownIdsRef.current.delete(msg.$id);
          setMessages(prev => prev.filter(m => m.$id !== msg.$id));
          return;
        }
        setMessages(prev => {
          let idx = prev.findIndex(m => m.$id === msg.$id);
          if (idx === -1) {
            idx = prev.findIndex(m =>
              !m._pending &&
              m.message  === msg.message  &&
              m.senderId === msg.senderId &&
              Math.abs(secToMs(m.createdAt) - secToMs(msg.createdAt)) < 5_000
            );
          }
          if (idx === -1) {
            scheduleSyncMutableFields(uid, chatId);
            return prev; 
          }
          const existing = prev[idx];
          if (
            existing.status                    === msg.status    &&
            existing.reactions                 === msg.reactions &&
            existing.edited                    === msg.edited    &&
            existing.message                   === msg.message   &&
            (existing.deletedFor?.length ?? 0) === (msg.deletedFor?.length ?? 0)
          ) return prev; // same reference → React skips re-render

          const next = [...prev];
          next[idx]  = {
            ...existing,
            status:     msg.status,
            reactions:  msg.reactions,
            edited:     msg.edited,
            message:    msg.message,
            deletedFor: msg.deletedFor,
            _pending:   false,
            _failed:    false,
          };
          return next;
        });

        return;
      }

      // ════════════════════════════════════════════════════════════════════
      // DELETE
      // ════════════════════════════════════════════════════════════════════
      if (eventType === 'DELETE') {
        const deletedId = o?.id;
        if (deletedId) {
          knownIdsRef.current.delete(deletedId);
          setMessages(prev => prev.filter(m => m.$id !== deletedId));
        }
      }
    };

    // ── Channel setup (Strategy 7) ─────────────────────────────────────────
    // Use a stable channel name (no Date.now()) so Supabase can reuse the
    // multiplexed WebSocket slot instead of creating a new one each render.
    const channelName = `msg_${chatId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  TABLES.messages,
          filter: `chat_id=eq.${chatId}`,
        },
        handlePayload
      )
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Back-off reconnect — don't hammer the server
          setTimeout(() => {
            if (channelRef.current === channel) loadMessages();
          }, 2_000);
        }
      });

    channelRef.current = channel;

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [chatId, user?.id]); // intentionally excludes loadMessages / scheduleSyncMutableFields

  // ─── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (
    text: string,
    opts?: {
      replyToId?:     string | null;
      replyToText?:   string | null;
      replyToSender?: string | null;
    }
  ) => {
    if (!chatId || !user?.id || !text.trim()) return;
    const uid    = user.id;
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Register BEFORE adding to state (race-condition safe)
    const pKey = makePendingKey(chatId, uid, text);
    pendingRegistry.set(pKey, tempId);

    // Optimistic bubble
    setMessages(prev => [...prev, {
      $id:           tempId,
      chatId,
      senderId:      uid,
      message:       text,
      type:          'text',
      status:        'sent',
      reactions:     '[]',
      createdAt:     Math.floor(Date.now() / 1000),
      deletedFor:    [],
      _pending:      true,
      replyToId:     opts?.replyToId     ?? undefined,
      replyToText:   opts?.replyToText   ?? undefined,
      replyToSender: opts?.replyToSender ?? undefined,
    }]);

    try {
      await callFn({
        action:        'send_message',
        chatId,
        message:       text,
        replyToId:     opts?.replyToId     ?? null,
        replyToText:   opts?.replyToText   ?? null,
        replyToSender: opts?.replyToSender ?? null,
      });
      // RT INSERT fires → registry match → tmp_ replaced with real row
    } catch (e: any) {
      console.error('[sendMessage] failed:', e?.message);
      pendingRegistry.delete(pKey); // clean up so future sends don't mismatch
      setMessages(prev => prev.map(m =>
        m.$id === tempId ? { ...m, _pending: false, _failed: true } : m
      ));
    }
  }, [chatId, user?.id]);

  // ─── Retry failed message ──────────────────────────────────────────────────
  const retryMessage = useCallback(async (msg: ChatMessage) => {
    setMessages(prev => prev.filter(m => m.$id !== msg.$id));
    await sendMessage(msg.message, {
      replyToId:     msg.replyToId,
      replyToText:   msg.replyToText,
      replyToSender: msg.replyToSender,
    });
  }, [sendMessage]);

  return {
    messages, setMessages, loading, loadingOld, hasMore,
    sendMessage, retryMessage, loadOlderMessages,
  };
};

export default useMessages;