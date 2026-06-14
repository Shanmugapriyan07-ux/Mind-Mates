// hooks/useOnlineStatus.ts
import { useEffect, useState } from 'react';
import { onlineStatusCache }   from '@/lib/onlineStatusCache';

export const useOnlineStatus = (targetUserId: string | null) => {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    // FIX: Reset immediately when userId changes so we never briefly show
    // the previous user's online status before the new subscription delivers.
    setIsOnline(false);
    setLastSeen(null);

    if (!targetUserId) return;

    const unsub = onlineStatusCache.subscribe(targetUserId, (status) => {
      setIsOnline(status.isOnline);
      setLastSeen(status.lastSeen);
    });

    return unsub;
  }, [targetUserId]);

  return { isOnline, lastSeen };
};