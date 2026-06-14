// hooks/useBadgeSync.ts
import { useAuthh } from '@/Contexts/authContext';
import { callFn } from '@/lib/callFn';
import { useEffect, useRef } from 'react';

export function useChatBadge(chatId: string | null | undefined) {
  const { user } = useAuthh();
  const ranFor   = useRef<string | null>(null);

  useEffect(() => {
    if (!chatId || chatId.trim() === '' || !user?.id) return;
    if (ranFor.current === chatId) return;
    ranFor.current = chatId;

    const uid = user.id;
    console.log('[Badge] calling mark_chat_read:', chatId);

    callFn({ action: 'mark_chat_read', chatId, userId: uid })
      .then(() => {
        console.log('[Badge] mark_chat_read success');
      })
      .catch((err) => {
        console.error('[Badge] mark_chat_read failed:', err?.message ?? err);
      });
  }, [chatId, user?.id]);

  useEffect(() => {
    return () => { ranFor.current = null; };
  }, [chatId]);
}