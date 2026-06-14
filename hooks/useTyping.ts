import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
const TYPING_DEBOUNCE_MS = 2500;
const TYPING_EXPIRE_MS   = 3500; 
interface UseTypingReturn {
  isOtherTyping: boolean;         
  onTypingInput: () => void;       
  onTypingStop:  () => void;       
}
export function useTyping(
  chatId:    string | null,
  myUserId:  string | null,
  otherUserId: string | null,    
): UseTypingReturn {
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef    = useRef<any>(null);
  const isSendingRef  = useRef(false);
  useEffect(() => {
    if (!chatId || !myUserId) return;
    const ch = supabase.channel(`typing:${chatId}-${Date.now()}`, {
      config: { broadcast: { self: false } },
    });
    ch.on('broadcast', { event: 'typing' }, ({ payload }: any) => {
      if (!otherUserId || payload?.userId !== otherUserId) return;
      setIsOtherTyping(true);
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
  const onTypingInput = useCallback(() => {
    if (!chatId) return;
    if (!isSendingRef.current) {
      isSendingRef.current = true;
      sendTyping();
    }
    clearTimeout(debounceRef.current!);
    debounceRef.current = setTimeout(() => {
      sendStopped();
    }, TYPING_DEBOUNCE_MS);
  }, [chatId, sendTyping, sendStopped]);
  const onTypingStop = useCallback(() => {
    clearTimeout(debounceRef.current!);
    if (isSendingRef.current) {
      sendStopped();
    }
  }, [sendStopped]);
  return { isOtherTyping, onTypingInput, onTypingStop };
}