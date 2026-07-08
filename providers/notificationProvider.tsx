import {
  clearAppIconBadge,
  initBadgeService,
  updateAppIconBadge,
} from "@/services/badgeService";
import {
  flushPendingNavigation,
} from "@/services/deepLinkService";
import {
  notificationService,
} from "@/services/notificationService";
import { useAuthStore } from "@/stores/authStore";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef } from "react";
let _foregroundListenerSub: Notifications.Subscription | null = null;
let _registrationInFlight = false; 
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { hydrated } = useAuthStore();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const registeredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (_foregroundListenerSub) return;
    initBadgeService();

    _foregroundListenerSub = Notifications.addNotificationReceivedListener(() => {
      Notifications.getBadgeCountAsync().then((current) => {
        updateAppIconBadge(current + 1);
      });
    });
  }, []);
  useEffect(() => {
    if (!userId) {
      clearAppIconBadge();
      if (registeredForRef.current) {
        notificationService
          .deleteTokenForUser(registeredForRef.current)
          .catch(() => {});
      }
      registeredForRef.current = null;
      return;
    }
    if (registeredForRef.current === userId) return;
    if (_registrationInFlight) return;
    registeredForRef.current = userId;
    _registrationInFlight = true;

    notificationService
      .registerForPushNotifications(userId)
      .then((token) => {
        if (token) console.log('[NotificationProvider] ✓ Token registered for', userId);
      })
      .catch((err) => console.error('[NotificationProvider] Registration failed', err))
      .finally(() => {
        _registrationInFlight = false;
      });

  }, [userId]);
  useEffect(() => {
    if (hydrated) flushPendingNavigation();
  }, [hydrated]);

  return <>{children}</>;
}