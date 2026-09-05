import {
    clearAppIconBadge,
    initBadgeService,
    updateAppIconBadge,
} from "@/services/badgeService";
import { flushPendingNavigation } from "@/services/deepLinkService";
import { notificationService } from "@/services/notificationService";
import { useAuthStore } from "@/stores/authStore";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef } from "react";
import { InteractionManager } from "react-native";

let _foregroundListenerSub: Notifications.Subscription | null = null;
let _registrationInFlight = false;
export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hydrated } = useAuthStore();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const registeredForRef = useRef<string | null>(null);
  console.count("NotificationProvider");
  useEffect(() => {
    if (_foregroundListenerSub) return;
    initBadgeService();

    _foregroundListenerSub = Notifications.addNotificationReceivedListener(
      () => {
        Notifications.getBadgeCountAsync().then((current) => {
          updateAppIconBadge(current + 1);
        });
      },
    );
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
    InteractionManager.runAfterInteractions(() => {
      notificationService
        .registerForPushNotifications(userId)
        .then(() => {})
        .catch((err) =>
          console.warn("[NotificationProvider] Registration failed", err),
        )
        .finally(() => (_registrationInFlight = false));
    });
  }, [userId]);
  useEffect(() => {
    if (hydrated) flushPendingNavigation();
  }, [hydrated]);

  return <>{children}</>;
}
