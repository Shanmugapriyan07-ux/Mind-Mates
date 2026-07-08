import { create } from 'zustand';

interface PendingNavigation {
  screen: string;
  params: Record<string, string>;
}

interface NotificationState {
  expoPushToken: string | null;
  pendingNavigation: PendingNavigation | null;
  setExpoPushToken: (token: string) => void;
  setPendingNavigation: (nav: PendingNavigation | null) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  expoPushToken: null,
  pendingNavigation: null,
  setExpoPushToken: (token) => set({ expoPushToken: token }),
  setPendingNavigation: (nav) => set({ pendingNavigation: nav }),
}));