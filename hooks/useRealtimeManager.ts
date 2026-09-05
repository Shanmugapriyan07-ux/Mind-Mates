import { useAuthh } from '@/Contexts/authContext';
import { realtimeManager } from '@/lib/realtimeManager';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useEffect } from 'react';
export const useRealtimeManager = () => {
  const { user } = useAuthh();
  const phase = useAuthStore(s => s.phase);
  const setConversations = useChatStore(s => s.setConversations);

  useEffect(() => {
    if (!user?.id || phase !== 'authenticated') return;
    const uid = user.id;
    let cancelled = false;

    loadConversations(uid, (data) => {
      if (!cancelled) setConversations(data);
    });
    realtimeManager.init(uid);

    return () => {
      cancelled = true;
      realtimeManager.destroy();
    };
  }, [phase, setConversations, user?.id]);
};

async function loadConversations(
  userId: string,
  onLoaded: (c: any[]) => void
) {
  const { data } = await supabase
    .from('conversation_members')
    .select(`
      chat_id,
      unread_count,
      chats (
        last_message,
        last_message_at,
        last_message_type,
        last_message_sender
      ),
      other_member:conversation_members!inner (
        user_id,
        users (
          user_id, name, profile_image, is_online, last_seen
        )
      )
    `)
    .eq('user_id', userId)
    .neq('other_member.user_id', userId)
    .order('chats(last_message_at)', { ascending: false });
  if (!data) return;
  const mapped = data.map((row: any) => {
    const other = row.other_member?.[0]?.users;
    const chat  = row.chats;
    return {
      chatId:          row.chat_id,
      otherUserId:     other?.user_id,
      otherName:       other?.name,
      otherImage:      other?.profile_image,
      lastMessage:     chat?.last_message,
      lastMessageAt:   chat?.last_message_at,
      lastMessageType: chat?.last_message_type ?? 'text',
      unreadCount:     row.unread_count,
      isOnline:        other?.is_online ?? false,
      lastSeen:        other?.last_seen,
    };
  });
   onLoaded(mapped);
}