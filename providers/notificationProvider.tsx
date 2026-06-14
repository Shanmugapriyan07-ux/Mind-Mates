import {
  clearAppIconBadge,
  initBadgeService,
  updateAppIconBadge,
} from "@/services/badgeService";
import {
  flushPendingNavigation,
  navigateFromNotification,
} from "@/services/deepLinkService";
import {
  NotificationPayload,
  notificationService,
} from "@/services/notificationService";
import { useAuthStore } from "@/stores/authStore";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
// At TOP of file — module level, survives everything
let _foregroundListenerSub: Notifications.Subscription | null = null;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { hydrated } = useAuthStore();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const registeredForRef = useRef<string | null>(null);

  // ── Foreground display listener — registered ONCE ever ───────────────────
  useEffect(() => {
    if (_foregroundListenerSub) return; // already registered, skip
    
    console.log('[NotificationProvider] registering foreground listener ONCE');
    initBadgeService();

    // Only foreground DISPLAY listener here — NO tap listener (that's in _layout.tsx)
    _foregroundListenerSub = Notifications.addNotificationReceivedListener((_notification) => {
      // App is in foreground — update badge count
      Notifications.getBadgeCountAsync().then((current) => {
        updateAppIconBadge(current + 1);
      });
    });

    // NO cleanup — must survive unmount/remount cycles
  }, []);

  // ── Token registration ────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      clearAppIconBadge();
      if (registeredForRef.current) {
        notificationService.deleteTokenForUser(registeredForRef.current).catch(() => {});
      }
      registeredForRef.current = null;
      return;
    }
    if (registeredForRef.current === userId) return;
    registeredForRef.current = userId;

    notificationService.registerForPushNotifications(userId)
      .then((token) => {
        if (token) console.log('[NotificationProvider] ✓ Token registered for', userId);
      })
      .catch((err) => console.error('[NotificationProvider] Registration failed', err));
  }, [userId]);

  // ── Flush pending deep-link once auth hydrates ────────────────────────────
  useEffect(() => {
    if (hydrated) flushPendingNavigation();
  }, [hydrated]);

  // ── Token refresh on foreground ───────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && registeredForRef.current === userId) {
        notificationService.registerForPushNotifications(userId).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [userId]);

  return <>{children}</>;
}