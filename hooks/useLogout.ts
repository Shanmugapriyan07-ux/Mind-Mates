// hooks/useLogout.ts
import { notificationService } from '@/services/notificationService';
import { realtimeService } from '@/services/realtimeService';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

export function useLogout() {
  const { logout } = useAuthStore();
  const { setPendingNavigation } = useNotificationStore();

  const performLogout = async () => {
    // 1. Clear all realtime channels
    realtimeService.unsubscribeAll();

    // 2. Clear notification listeners
    notificationService.destroy();

    // 3. Clear pending navigation queue
    setPendingNavigation(null);
    await logout();
  };

  return { performLogout };
}