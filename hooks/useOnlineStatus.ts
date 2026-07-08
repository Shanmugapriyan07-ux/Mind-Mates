import { useEffect, useState } from 'react';
import { onlineStatusCache }   from '@/lib/onlineStatusCache';
export const useOnlineStatus = (targetUserId: string | null) => {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
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