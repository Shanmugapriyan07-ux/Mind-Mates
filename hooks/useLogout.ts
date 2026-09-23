import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
export function useLogout() {
  const { logout } = useAuthStore();
  const { setPendingNavigation } = useNotificationStore();
  const performLogout = async () => {
    notificationService.destroy();
    setPendingNavigation(null);
    await logout();
  };
  return { performLogout };
}