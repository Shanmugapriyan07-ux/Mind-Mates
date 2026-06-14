// hooks/useChatBadge.ts
import { useAuthh } from '@/Contexts/authContext';
import { callFn } from '@/lib/callFn';
import { useEffect } from 'react';

export const useChatBadge = (chatId: string | null) => {
  const { user } = useAuthh();
  useEffect(() => {
    if (!chatId || !user?.id) return;
    const markRead = async () => {
      try {
        await callFn({ action: 'mark_chat_read', chatId, userId: user.id });
      } catch (err: any) {
        console.warn('[useChatBadge] mark_chat_read failed:', err?.message ?? err);
      }
    };
    markRead();
  }, [chatId, user?.id]);
};