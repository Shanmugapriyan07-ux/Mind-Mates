import { ProfileAvatar } from "@/components/Profileavatar";
import { useAuthh } from "@/Contexts/authContext";
import { useConnection } from "@/hooks/useConnection";
import supabase, { TABLES } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

interface NotifItem {
  id: string;
  user_id: string;
  sender_id: string;
  sender_name: string;
  sender_image: string;
  sender_skills: string;
  sender_location: string;
  type: "connection_request" | "accepted";
  connection_id: string;
  is_read: boolean;
  created_at: string;
}

const DELETE_BTN_W = 80;

const C = {
  white: "#FFFFFF",
  purple: "#6D4AFF",
  text: "#0F0F10",
  sub: "#6b6b6d",
  border: "#EAECF0",
  green: "#16A34A",
  red: "#f42121",
  redBg: "#FEF2F2",
  skeleton: "#F0F0F3",
  unread: "#F5F3FF",
  bg: "#F7F8FA",
  redDark: "#e12b2b",
};

const HINT_STORAGE_KEY = "notif_swipe_hint_seen_v1";
const HINT_NUDGE       = -25;

const SwipeHintManager = (() => {
  let _checked = false;
  let _seen    = false;
  let _fired   = false;
  let _pending: (() => void) | null = null;

  const _init = async () => {
    try {
      const val = await AsyncStorage.getItem(HINT_STORAGE_KEY);
      _seen = val === "true";
    } catch {
      _seen = false;
    }
    _checked = true;
    if (!_seen && _pending) {
      const cb = _pending;
      _pending = null;
      cb();
    }
  };

  const tryRegister = (onHint: () => void) => {
    if (_fired || _seen) return;
    if (!_checked) {
      if (!_pending) {
        _pending = () => {
          if (!_fired && !_seen) { _fired = true; onHint(); }
        };
        _init();
      }
      return;
    }
    if (!_fired && !_seen) { _fired = true; onHint(); }
  };

  const markSeen = () => {
    _seen = true;
    AsyncStorage.setItem(HINT_STORAGE_KEY, "true").catch(() => {});
  };

  return { tryRegister, markSeen };
})();
const timeAgo = (ts: string | number): string => {
  const ms =
    typeof ts === "string"
      ? new Date(ts).getTime()
      : ts < 4_102_444_800
        ? ts * 1000
        : ts;
  if (!ms || isNaN(ms)) return "";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m `;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h `;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d `;
  if (d < 30) return `${Math.floor(d / 7)}w `;
  return `${Math.floor(d / 30)}mo ago`;
};

const parseSkills = (s: string) =>
  s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];

const dedup = (items: NotifItem[]) => {
  const seen = new Set<string>();
  return items.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
};

const ActionSheet = ({
  item, onClose, onDelete, onViewProfile,
}: {
  item: NotifItem | null;
  onClose: () => void;
  onDelete: () => void;
  onViewProfile: (uid: string) => void;
}) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sh.backdrop} onPress={onClose}>
        <Pressable style={[sh.card, { paddingBottom: insets.bottom + 14 }]} onPress={() => {}}>
          <View style={sh.handle} />
          <TouchableOpacity
            style={sh.row}
            onPress={() => { onViewProfile(item?.sender_id ?? ""); onClose(); }}
            activeOpacity={0.7}
          >
            <View style={sh.iconBox}>
              <Ionicons name="person" size={20} color={C.white} />
            </View>
            <Text style={sh.rowText}>View Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={sh.row}
            onPress={() => { onDelete(); onClose(); }}
            activeOpacity={0.7}
          >
            <View style={sh.iconBox}>
              <Ionicons name="trash" size={20} color={C.white} />
            </View>
            <Text style={[sh.rowText, { color: C.text }]}>Delete Notification</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sh.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={sh.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const sh = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  card: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    elevation: 20, paddingHorizontal: 16, paddingTop: 12,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: -4 } },
      android: { shadowColor: "#000", borderColor: "rgba(0,0,0,0.12)" },
      default: {},
    }),
  },
  iconBox: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#6D4AFF" },
  handle:  { width: 42, height: 4, borderRadius: 2, backgroundColor: "#DDD", alignSelf: "center", marginBottom: 18 },
  row:     { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  rowText: { fontSize: 16, fontWeight: "600", color: C.text, marginLeft: 14 },
  cancelBtn:  { marginHorizontal: 16, marginTop: 14, paddingVertical: 14, borderRadius: 14, backgroundColor: "#DDD", alignItems: "center" },
  cancelText: { fontSize: 16, fontWeight: "600", color: "#000000" },
});
const Skeleton = ({ opacity = 1 }: { opacity?: number }) => (
  <View style={[s.card, { opacity }]}>
    <View style={s.cardRow}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.skeleton }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 13, width: "50%", backgroundColor: C.skeleton, borderRadius: 6 }} />
        <View style={{ height: 11, width: "35%", backgroundColor: C.skeleton, borderRadius: 6 }} />
      </View>
    </View>
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
      <View style={{ flex: 1, height: 36, backgroundColor: C.skeleton, borderRadius: 10 }} />
      <View style={{ flex: 1, height: 36, backgroundColor: C.skeleton, borderRadius: 10 }} />
    </View>
  </View>
);
const SwipeableNotifCard = React.memo(({
  item, onAccept, onReject, actionLoading, onMenu,
  onSwipeDelete, onSwipeOpen, onSwipeClose, deleteThreshold,
  isFirstCard,   
}: {
  item: NotifItem;
  onAccept: (i: NotifItem) => void;
  onReject: (i: NotifItem) => void;
  actionLoading: string | null;
  onMenu: (i: NotifItem) => void;
  onSwipeDelete: (i: NotifItem) => void;
  onSwipeOpen: (id: string) => void;
  onSwipeClose: (id: string) => void;
  deleteThreshold: number;
  isFirstCard: boolean;  
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen     = useRef(false);
  const hintPlaying = useRef(false);  

  const skills   = parseSkills(item.sender_skills);
  const skillDots = skills.slice(0, 3).join(" · ");
  const extra    = skills.length - 3;
  const busy     = actionLoading === item.id;
  const accepted = item.type === "accepted";
  const deleteBtnOpacity = translateX.interpolate({
    inputRange:  [deleteThreshold, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const snapOpen = () => {
    Animated.spring(translateX, {
      toValue: deleteThreshold, useNativeDriver: true, damping: 200, stiffness: 200,
    }).start();
    isOpen.current = true;
    onSwipeOpen(item.id);
  };

  const snapClose = () => {
    Animated.spring(translateX, {
      toValue: 0, useNativeDriver: true, damping: 200, stiffness: 200,
    }).start();
    isOpen.current = false;
    onSwipeClose(item.id);
  };
  const playHint = useCallback(() => {
    if (hintPlaying.current) return;
    hintPlaying.current = true;
    setTimeout(() => {
      Animated.sequence([
        Animated.spring(translateX, {
          toValue: HINT_NUDGE,
          useNativeDriver: true,
          damping: 18,
          stiffness: 260,
          mass: 0.6,
        }),
        Animated.delay(350),
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 240,
          mass: 0.7,
        }),
      ]).start(({ finished }) => {
        if (finished) SwipeHintManager.markSeen();
        hintPlaying.current = false;
      });
    }, 2000);
  }, [translateX]);
  useEffect(() => {
    if (isFirstCard) SwipeHintManager.tryRegister(playHint);
  }, [isFirstCard, playHint]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        if (hintPlaying.current) {
          translateX.stopAnimation();
          translateX.setValue(0);
          hintPlaying.current = false;
          SwipeHintManager.markSeen(); 
        }
      },
      onPanResponderMove: (_, g) => {
        const newX = Math.max(
          deleteThreshold * 1.2,
          Math.min(0, g.dx + (isOpen.current ? deleteThreshold : 0)),
        );
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_, g) => {
        const currentX = g.dx + (isOpen.current ? deleteThreshold : 0);
        if (currentX < deleteThreshold * 0.6) snapOpen();
        else snapClose();
      },
      onPanResponderTerminate: () => { snapClose(); },
    }),
  ).current;

  return (
    <View style={sw.wrapper}>
      <Animated.View style={[sw.deleteBehind, { opacity: deleteBtnOpacity }]}>
        <TouchableOpacity
          style={sw.deleteBtn}
          activeOpacity={0.85}
          onPress={() => { snapClose(); setTimeout(() => onSwipeDelete(item), 150); }}
        >
          <Ionicons name="trash" size={22} color="#fff" />
          <Text style={sw.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[sw.cardSlide, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => { if (isOpen.current) snapClose(); }}
          style={[s.card, !item.is_read && s.cardUnread]}
        >
          {!item.is_read && <View style={s.unreadBar} />}
          <View style={s.cardRow}>
            <TouchableOpacity
              onPress={() => {
                if (isOpen.current) { snapClose(); return; }
                router.push({ pathname: "/subScreens/userProfile", params: { userId: item.sender_id } });
              }}
              activeOpacity={0.8}
            >
              <ProfileAvatar uri={item.sender_image || null} name={item.sender_name} size={52} style={{ marginBottom: 14 }} />
            </TouchableOpacity>

            <View style={s.info}>
              <Text style={s.name} numberOfLines={1}>{item.sender_name || "Someone"}</Text>
              {!!item.sender_location && (
                <View style={s.locRow}>
                  <Ionicons name="location-sharp" size={11} color={C.sub} />
                  <Text style={s.locText} numberOfLines={1}>{item.sender_location}</Text>
                </View>
              )}
              {!!skillDots && (
                <View style={s.skillsRow}>
                  <Text style={s.skillsText} numberOfLines={1}>{skillDots}</Text>
                  {extra > 0 && (
                    <View style={s.extraBadge}>
                      <Text style={s.extraText}>+{extra}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={s.cardMeta}>
              <Text style={s.time}>{timeAgo(item.created_at)}</Text>
              <TouchableOpacity
                onPress={() => {
                  if (isOpen.current) { snapClose(); return; }
                  onMenu(item);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="ellipsis-vertical" size={15} color={C.sub}
                  style={{ alignSelf: "center", paddingBottom: 25 }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {!accepted && (
            <View style={[s.actions, { marginTop: 10 }]}>
              <TouchableOpacity
                style={[s.btnAccept, busy && s.btnDisabled]}
                onPress={() => { if (isOpen.current) { snapClose(); return; } onAccept(item); }}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={15} color="#fff" />
                    <Text style={s.btnAcceptText}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnDecline, busy && s.btnDisabled]}
                onPress={() => { if (isOpen.current) { snapClose(); return; } onReject(item); }}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={15} color={C.red} />
                <Text style={s.btnDeclineText}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});
const sw = StyleSheet.create({
  wrapper:     { position: "relative", overflow: "hidden" },
  deleteBehind: {
    position: "absolute", right: 0, top: 0, bottom: 0, width: DELETE_BTN_W,
    backgroundColor: C.purple, justifyContent: "center", alignItems: "center",
  },
  deleteBtn:    { alignItems: "center", justifyContent: "center", flex: 1, width: "100%", gap: 4 },
  deleteBtnText:{ color: "#fff", fontSize: 12, fontWeight: "700" },
  cardSlide:    { backgroundColor: C.white },
});
const BulkDeleteBar = ({ count, onDeleteAll }: { count: number; onDeleteAll: () => void }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: count >= 2 ? 1 : 0, useNativeDriver: true, damping: 140, stiffness: 350,
    }).start();
  }, [count >= 2]);
  if (count < 2) return null;
  return (
    <Animated.View style={[bk.bar, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-44, 0] }) }],
    }]}>
      <View style={bk.left}>
        <View style={bk.countBadge}><Text style={bk.countNum}>{count}</Text></View>
        <Text style={bk.label}>Notifications selected</Text>
      </View>
      <TouchableOpacity style={bk.deleteBtn} onPress={onDeleteAll} activeOpacity={0.85}>
        <Ionicons name="trash" size={15} color={"#ffffff"} />
        <Text style={bk.deleteTxt}>Delete all</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};
const bk = StyleSheet.create({
  bar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#1C1C1E", paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, marginHorizontal: 12, marginBottom: 6,
    shadowColor: C.red, shadowOpacity: 0.35, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  left:       { flexDirection: "row", alignItems: "center", gap: 10 },
  countBadge: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, minWidth: 26, alignItems: "center" },
  countNum:   { color: "#ffffff", fontWeight: "800", fontSize: 13 },
  label:      { color: "#ffffff", fontSize: 13, fontWeight: "500" },
  deleteBtn:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#6D4AFF", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  deleteTxt:  { color: "#ffffff", fontWeight: "700", fontSize: 13 },
});
const Header = ({}: { count: number }) => (
  <View style={s.header}>
    <Text style={s.headerTitle}>Notifications</Text>
  </View>
);
export default function NotificationsScreen() {
  const { user } = useAuthh();
  const { acceptRequest, rejectRequest, setStatus } = useConnection();

  const { width: screenWidth } = useWindowDimensions();
  const deleteThreshold = -screenWidth * 0.28;
  const insets = useSafeAreaInsets();

  const [notifs,        setNotifs]        = useState<NotifItem[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sheetItem,     setSheetItem]     = useState<NotifItem | null>(null);
  const [swipedIds,     setSwipedIds]     = useState<Set<string>>(new Set());

  const safeSet = useCallback(
    (fn: (p: NotifItem[]) => NotifItem[]) => setNotifs((p: any) => dedup(fn(p))),
    [],
  );

  const loadNotifs = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.notifications)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifs(dedup((data ?? []) as unknown as NotifItem[]));
    } catch (e: any) {
      console.warn(" loadNotifs:", e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, loading]);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`notifs-${user.id}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.notifications, filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const doc = payload.new as NotifItem;
          if (payload.eventType === "INSERT") safeSet((p: any) => [doc, ...p]);
          if (payload.eventType === "DELETE") setNotifs((p: any) => p.filter((n: any) => n.id !== (payload.old as any).id));
          if (payload.eventType === "UPDATE") setNotifs((p: any) => p.map((n: any) => (n.id === doc.id ? { ...n, ...doc } : n)));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, safeSet]);

  useEffect(() => {
    if (!user?.id || !notifs.length) return;
    const unreadToMark = notifs.filter((n: NotifItem) => !n.is_read && n.type !== "connection_request");
    if (!unreadToMark.length) return;
    setNotifs((p: NotifItem[]) =>
      p.map((n: NotifItem) => unreadToMark.some((um) => um.id === n.id) ? { ...n, is_read: true } : n),
    );
    Promise.all(
      unreadToMark.map((n: NotifItem) =>
        supabase.from(TABLES.notifications).update({ is_read: true }).eq("id", n.id),
      ),
    ).catch((e) => console.warn("Failed to mark notifications as read:", e));
  }, [notifs.length, user?.id]);

  const handleSwipeOpen  = useCallback((id: string) => setSwipedIds((prev) => new Set([...prev, id])), []);
  const handleSwipeClose = useCallback((id: string) => setSwipedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }), []);

  const handleDelete = useCallback(async (item: NotifItem) => {
    setNotifs((prev: any) => prev.filter((n: any) => n.id !== item.id));
    const { error } = await supabase
      .from(TABLES.notifications).delete().eq("id", item.id).eq("user_id", user?.id ?? "");
    if (error) {
      console.warn(" Notif delete failed:", error.message);
      setNotifs((prev: any) =>
        dedup([item, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())),
      );
    }
  }, [user?.id]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(swipedIds);
    const toDelete = notifs.filter((n: any) => ids.includes(n.id));
    setNotifs((prev: any) => prev.filter((n: any) => !ids.includes(n.id)));
    setSwipedIds(new Set());
    const results = await Promise.all(
      ids.map((id) => supabase.from(TABLES.notifications).delete().eq("id", id).eq("user_id", user?.id ?? "")),
    );
    const failed = results.reduce<NotifItem[]>((acc, res, i) => {
      if (res.error) { console.warn(" Bulk delete failed for", ids[i]); acc.push(toDelete[i]); }
      return acc;
    }, []);
    if (failed.length) {
      setNotifs((prev: any) =>
        dedup([...failed, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())),
      );
    }
  }, [swipedIds, notifs, user?.id]);

  const handleAccept = useCallback(async (item: NotifItem) => {
    setActionLoading(item.id);
    setNotifs((p: any) => p.map((n: any) => (n.id === item.id ? { ...n, type: "accepted" } : n)));
    setStatus(item.sender_id, "accepted");
    try {
      await acceptRequest(item.connection_id, item.id, item.sender_id);
    } catch {
      setNotifs((p: any) => p.map((n: any) => (n.id === item.id ? { ...n, type: "connection_request" } : n)));
      setStatus(item.sender_id, "pending");
    } finally {
      setActionLoading(null);
    }
  }, [acceptRequest, setStatus]);

  const handleReject = useCallback(async (item: NotifItem) => {
    setNotifs((p) => p.filter((n: any) => n.id !== item.id));
    setStatus(item.sender_id, "none");
    rejectRequest(item.connection_id, item.id, item.sender_id).catch(() => loadNotifs());
  }, [rejectRequest, setStatus, loadNotifs]);

  if (loading)
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <Header count={0} />
        <Skeleton /><Skeleton opacity={0.65} /><Skeleton opacity={0.35} />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <Header count={notifs.filter((n: any) => !n.is_read).length} />
      <BulkDeleteBar count={swipedIds.size} onDeleteAll={handleBulkDelete} />

      <FlatList
        data={notifs}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <SwipeableNotifCard
            item={item}
            onAccept={handleAccept}
            onReject={handleReject}
            actionLoading={actionLoading}
            onMenu={setSheetItem}
            onSwipeDelete={handleDelete}
            onSwipeOpen={handleSwipeOpen}
            onSwipeClose={handleSwipeClose}
            deleteThreshold={deleteThreshold}
            isFirstCard={index === 0}  
          />
        )}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadNotifs(true)} tintColor={C.purple} colors={[C.purple]} />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="notifications-outline" size={32} color={C.purple} />
            </View>
            <Text style={s.emptyTitle}>No notifications yet</Text>
            <Text style={s.emptySub}>When someone wants to connect, it'll appear here.</Text>
          </View>
        }
      />

      <ActionSheet
        item={sheetItem}
        onClose={() => setSheetItem(null)}
        onDelete={() => sheetItem && handleDelete(sheetItem)}
        onViewProfile={(uid) => router.push({ pathname: "/subScreens/userProfile", params: { userId: uid } })}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.white },
  list:        {},
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 19, fontWeight: "600", color: C.text, flex: 1 },
  badgeText:   { color: "#fff", fontWeight: "700", fontSize: 12 },
  card:        { backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 6, overflow: "hidden" },
  cardUnread:  { backgroundColor: C.unread },
  unreadBar:   { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: C.purple },
  cardRow:     { flexDirection: "row", alignItems: "center", gap: 12 },
  info:        { flex: 1 },
  name:        { fontSize: 14, fontWeight: "600", color: C.text, marginBottom: 3 },
  locRow:      { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 3 },
  locText:     { fontSize: 12, color: C.sub },
  skillsRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginRight: 3 },
  skillsText:  { fontSize: 12, fontWeight: "600", color: C.purple, flexShrink: 1 },
  extraBadge:  { backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.border },
  extraText:   { fontSize: 11, fontWeight: "600", color: C.sub },
  cardMeta:    { alignItems: "flex-end", justifyContent: "space-between", alignSelf: "stretch" },
  time:        { fontSize: 9, color: C.sub},
  actions:     { flexDirection: "row", gap: 10 },
  btnAccept:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.purple, borderRadius: 10, paddingVertical: 9 },
  btnAcceptText:  { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnDecline:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.redBg, borderRadius: 10, paddingVertical: 9, borderWidth: 1, borderColor: "#FECACA" },
  btnDeclineText: { color: C.red, fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  empty:       { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon:   { width: 72, height: 72, borderRadius: 36, backgroundColor: C.unread, alignItems: "center", justifyContent: "center", marginBottom: 13 },
  emptyTitle:  { fontSize: 17, fontWeight: "600", color: C.text, marginBottom: 2 },
  emptySub:    { fontSize: 13, color: C.sub, textAlign: "center", lineHeight: 22 },
});