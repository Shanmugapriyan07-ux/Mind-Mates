// hooks/usePresence.ts
import { useEffect }       from 'react';
import { useAuthh }        from '@/Contexts/authContext';
import { presenceService } from '@/lib/presenceService';

/**
 * Call ONCE in root _layout.tsx only.
 * Never destroys on navigation — presence survives screen changes.
 * destroy() is called only on logout via authService.
 */
export const usePresence = () => {
  const { user } = useAuthh();

  useEffect(() => {
    if (!user?.id) return;
    presenceService.init(user.id);
    // No cleanup — intentional
    // destroy() called by logout flow only
  }, [user?.id]);
};