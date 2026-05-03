
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const TYPING_DEBOUNCE_MS = 2500;   // stop event fires after this many ms of silence
const TYPING_EXPIRE_MS   = 3500;   // safety: clear indicator if no heartbeat in 3.5s

interface UseTypingReturn {
  isOtherTyping: boolean;           // true when the other user is currently typing
  onTypingInput: () => void;        // call this on every TextInput keystroke
  onTypingStop:  () => void;        // call on blur / send
}

export function useTyping(
  chatId:    string | null,
  myUserId:  string | null,
  otherUserId: string | null,        // used to know whose indicator to show
): UseTypingReturn {

  const [isOtherTyping, setIsOtherTyping] = useState(false);

  // Refs — never cause re-renders
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef    = useRef<any>(null);
  const isSendingRef  = useRef(false); // true between "typing" and "stopped" events

  // ── Subscribe to broadcast channel ───────────────────────────
  useEffect(() => {
    if (!chatId || !myUserId) return;

    // Unique channel name per conversation
    const ch = supabase.channel(`typing:${chatId}`, {
      config: { broadcast: { self: false } }, // don't receive own events
    });

    ch.on('broadcast', { event: 'typing' }, ({ payload }: any) => {
      // Only care about the other user in this 1:1 chat
      if (!otherUserId || payload?.userId !== otherUserId) return;

      setIsOtherTyping(true);

      // Safety expire: if we never get "stopped", clear after 3.5s
      clearTimeout(expireRef.current!);
      expireRef.current = setTimeout(() => {
        setIsOtherTyping(false);
      }, TYPING_EXPIRE_MS);
    });

    ch.on('broadcast', { event: 'stopped' }, ({ payload }: any) => {
      if (!otherUserId || payload?.userId !== otherUserId) return;
      clearTimeout(expireRef.current!);
      setIsOtherTyping(false);
    });

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
      clearTimeout(debounceRef.current!);
      clearTimeout(expireRef.current!);
    };
  }, [chatId, myUserId, otherUserId]);

  // ── Send typing broadcast ─────────────────────────────────────
  const sendTyping = useCallback(() => {
    if (!channelRef.current || !myUserId) return;
    channelRef.current.send({
      type:    'broadcast',
      event:   'typing',
      payload: { userId: myUserId },
    });
  }, [myUserId]);

  const sendStopped = useCallback(() => {
    if (!channelRef.current || !myUserId) return;
    channelRef.current.send({
      type:    'broadcast',
      event:   'stopped',
      payload: { userId: myUserId },
    });
    isSendingRef.current = false;
  }, [myUserId]);

  // ── onTypingInput — call on EVERY TextInput onChange ──────────
  // Debounce pattern:
  //   First keystroke → send "typing" once ← isSendingRef gates this
  //   Every keystroke → reset 2.5s idle timer
  //   2.5s silence   → send "stopped"
  const onTypingInput = useCallback(() => {
    if (!chatId) return;

    // Send "typing" only once per burst
    if (!isSendingRef.current) {
      isSendingRef.current = true;
      sendTyping();
    }

    // Reset idle timer on every keystroke
    clearTimeout(debounceRef.current!);
    debounceRef.current = setTimeout(() => {
      sendStopped();
    }, TYPING_DEBOUNCE_MS);
  }, [chatId, sendTyping, sendStopped]);

  // ── onTypingStop — call on send / blur ───────────────────────
  const onTypingStop = useCallback(() => {
    clearTimeout(debounceRef.current!);
    if (isSendingRef.current) {
      sendStopped();
    }
  }, [sendStopped]);

  return { isOtherTyping, onTypingInput, onTypingStop };
}