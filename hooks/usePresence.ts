import { useEffect }       from 'react';
import { useAuthh }        from '@/Contexts/authContext';
import { presenceService } from '@/lib/presenceService';
export const usePresence = () => {
  const { user } = useAuthh();

  useEffect(() => {
    if (!user?.id) return;
    presenceService.init(user.id);
  }, [user?.id]);
};