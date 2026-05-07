import { useAuthh } from "@/Contexts/authContext";
import { updateAppIconBadge } from "@/services/badgeService";
import {
  handleKilledStateNotification,
  registerPushToken,
  setupNotificationResponseListener,
} from "@/services/notificationService";
import {
  destroySyncService,
  initSyncService,
  onChatOpened,
  onNotifScreenOpened,
} from "@/services/syncService";
import { useUnreadStore } from "@/stores/useUnreadStore";
import { useCallback, useEffect, useRef } from "react";

// ── Main badge sync hook ──────────────────────────────────────────
// Add this ONCE at the root of your app (root layout or auth wrapper).
// Pass userId — it handles init, cleanup, and re-init on user change.
export const useBadgeSync = (
  userId: string | null,
  onNavigateToChat?: (chatId: string) => void,
  onNavigateToNotifs?: () => void,
): void => {
  const prevUserId = useRef<string | null>(null);

  // ── Subscribe to totalUnread changes → update app icon badge ──
  // This useEffect runs whenever totalUnread changes in the Zustand store.
  // It's the bridge between the store and the OS badge API.
  useEffect(() => {
    // Subscribe to store changes — Zustand v4+ subscribe takes one listener
    const unsub = useUnreadStore.subscribe((state: any) => {
      if (state.totalUnread !== undefined) {
        updateAppIconBadge(state.totalUnread);
      }
    });
    return unsub;
  }, []);

  // ── Init / re-init sync when userId changes ────────────────────
  useEffect(() => {
    if (!userId) {
      // User logged out
      if (prevUserId.current) {
        destroySyncService();
        prevUserId.current = null;
      }
      return;
    }

    if (prevUserId.current === userId) return; // same user, skip
    prevUserId.current = userId;

    const setup = async () => {
      // Start sync service (realtime + initial fetch)
      await initSyncService(userId);

      // Register push token for background notifications
      await registerPushToken(userId);

      // Handle app-opened-from-killed-state notification
      if (onNavigateToChat || onNavigateToNotifs) {
        await handleKilledStateNotification(
          (chatId) => onNavigateToChat?.(chatId),
          () => onNavigateToNotifs?.(),
        );
      }
    };

    setup().catch((e) => console.error("[useBadgeSync] Setup failed:", e));

    // Cleanup on unmount or userId change
    return () => {
      destroySyncService();
      prevUserId.current = null;
    };
  }, [userId]);

  // ── Notification tap listener (foreground + background) ────────
  useEffect(() => {
    if (!userId || (!onNavigateToChat && !onNavigateToNotifs)) return;

    const cleanup = setupNotificationResponseListener(
      (chatId) => onNavigateToChat?.(chatId),
      () => onNavigateToNotifs?.(),
    );

    return cleanup;
  }, [userId, onNavigateToChat, onNavigateToNotifs]);
};

// ── Chat screen hook ──────────────────────────────────────────────
// Call in any chat screen to clear that chat's badge on open.
export const useChatBadge = (chatId: string): { onOpen: () => void } => {
  const { user } = useCurrentUser(); // your existing auth context hook

  const onOpen = useCallback(() => {
    if (!user?.id || !chatId) return;
    onChatOpened(chatId, user.id).catch(console.warn);
  }, [chatId, user?.id]);

  // Auto-clear when screen mounts
  useEffect(() => {
    onOpen();
  }, []); // run once on mount

  return { onOpen };
};

// ── Notification screen hook ───────────────────────────────────────
export const useNotifBadge = (): { onOpen: () => void } => {
  const { user } = useCurrentUser();

  const onOpen = useCallback(() => {
    if (!user?.id) return;
    onNotifScreenOpened(user.id).catch(console.warn);
  }, [user?.id]);

  useEffect(() => {
    onOpen();
  }, []);

  return { onOpen };
};

// ── Badge count selectors (for UI components) ─────────────────────
// These have stable references — safe to use in React.memo components.

// Total badge for tab bar icon
export const useTotalUnread = (): number =>
  useUnreadStore((s: any) => s.totalUnread);

// Chat count for chat tab icon
export const useChatUnread = (): number =>
  useUnreadStore((s: any) => s.chatUnread);

// Notif count for notification tab icon
export const useNotifUnread = (): number =>
  useUnreadStore((s: any) => s.notifUnread);

// Per-chat dot for individual chat rows
export const useChatDot = (chatId: string): number =>
  useUnreadStore((s: any) => s.perChatUnread[chatId] ?? 0);

// ── Formatted badge count ─────────────────────────────────────────
// Returns '' for 0, number string for 1-99, '99+' for 100+
export const useFormattedBadge = (type: "total" | "chat" | "notif"): string => {
  const count = useUnreadStore((s: any) =>
    type === "total"
      ? s.totalUnread
      : type === "chat"
        ? s.chatUnread
        : s.notifUnread,
  );
  if (count <= 0) return "";
  if (count <= 99) return String(count);
  return "99+";
};

// ── Helper: get current user from your existing context ───────────
const useCurrentUser = () => {
  return useAuthh();
};
