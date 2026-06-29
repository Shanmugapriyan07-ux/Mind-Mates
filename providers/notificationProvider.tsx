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

// Module-level — survives unmount/remount
let _foregroundListenerSub: Notifications.Subscription | null = null;
let _registrationInFlight = false; // ✅ prevents concurrent registration attempts

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { hydrated } = useAuthStore();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const registeredForRef = useRef<string | null>(null);

  // ── Foreground listener — registered ONCE ever ────────────────────────────
  useEffect(() => {
    if (_foregroundListenerSub) return;

    console.log('[NotificationProvider] registering foreground listener ONCE');
    initBadgeService();

    _foregroundListenerSub = Notifications.addNotificationReceivedListener(() => {
      Notifications.getBadgeCountAsync().then((current) => {
        updateAppIconBadge(current + 1);
      });
    });
    // NO cleanup — intentional
  }, []);

  // ── Token registration — ONCE per userId, never retried from here ─────────
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

    // ✅ Already registered for this user — skip
    if (registeredForRef.current === userId) return;

    // ✅ Another registration already in-flight — skip
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

  // ── Flush pending deep-link once auth hydrates ────────────────────────────
  useEffect(() => {
    if (hydrated) flushPendingNavigation();
  }, [hydrated]);

  // ✅ REMOVED: AppState foreground retry — was causing infinite error loop

  return <>{children}</>;
}