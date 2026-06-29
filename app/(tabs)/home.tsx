import { ChatMenuSheet } from "@/components/blockSheet";
import CommunityGuidelinesSheet from "@/components/communityGuidelinesSheet";
import ConfirmModal from "@/components/confirmModel";
import { FriendsSearchModal } from "@/components/FriendSearchModel";
import { Friend, SwipeableRow } from "@/components/SwipeableRow";
import { useAuthh } from "@/Contexts/authContext";
import { callFn } from "@/lib/callFn";
import { supabase, TABLES } from "@/lib/supabase";
import { TYPOGRAPHY } from "@/theme/typography";
import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// ─── Cache helpers ────────────────────────────────────────────────────────────
const cacheGet = async (k: string): Promise<string | null> => {
  try {
    if (Platform.OS === "web") return localStorage.getItem(k);
    return require("@react-native-async-storage/async-storage").default.getItem(
      k,
    );
  } catch {
    return null;
  }
};
const cacheSet = async (k: string, v: string) => {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(k, v);
      return;
    }
    require("@react-native-async-storage/async-storage")
      .default.setItem(k, v)
      .catch(() => {});
  } catch {}
};

const C = {
  white: "#FFFFFF",
  purple: "#6D4AFF",
  text: "#111827",
  muted: "#6B7280",
  red: "#EF4444",
  skeleton: "#E9EAEC",
};

const CACHE_KEY = (uid: string) => `friends_v6_${uid}`;
const CACHE_TTL = 60 * 1000;
const toMs = (ts?: string | null) => (ts ? new Date(ts).getTime() : 0);

const sortFriends = (list: Friend[]) =>
  [...list].sort((a, b) => {
    const ua = a.unread_count ?? 0,
      ub = b.unread_count ?? 0;
    if (ua !== ub) return ub - ua;
    return toMs(b.last_message_at) - toMs(a.last_message_at);
  });

const orderChanged = (a: Friend[], b: Friend[]) =>
  a.length !== b.length ||
  a.some((f, i) => f.connection_id !== b[i]?.connection_id);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonRow = ({ opacity = 1 }: { opacity?: number }) => (
  <View style={[sk.row, { opacity }]}>
    <View
      style={{
        width: s(52),
        height: s(52),
        borderRadius: s(26),
        backgroundColor: C.skeleton,
      }}
    />
    <View style={{ flex: 1, gap: vs(8) }}>
      <View
        style={{
          height: vs(11),
          width: "45%",
          backgroundColor: C.skeleton,
          borderRadius: s(5),
        }}
      />
      <View
        style={{
          height: vs(11),
          width: "65%",
          backgroundColor: C.skeleton,
          borderRadius: s(5),
        }}
      />
    </View>
  </View>
);
const sk = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(15),
    paddingVertical: vs(8),
    gap: s(12),
    minHeight: vs(72),
  },
});

const BulkDeleteBar = ({
  count,
  onDeleteAll,
}: {
  count: number;
  onDeleteAll: () => void;
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: count >= 2 ? 1 : 0,
      useNativeDriver: true,
      damping: 150,
      stiffness: 350,
    }).start();
  }, [count >= 2]);

  if (count < 2) return null;

  return (
    <Animated.View
      style={[
        bk.bar,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-vs(44), 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={bk.left}>
        <View style={bk.badge}>
          <Text style={bk.num}>{count}</Text>
        </View>
        <Text style={bk.label}>chats selected</Text>
      </View>
      <TouchableOpacity
        style={bk.btn}
        onPress={onDeleteAll}
        activeOpacity={0.85}
      >
        <Ionicons name="trash" size={s(14)} color="#ffffff" />
        <Text style={bk.btnTxt}>Delete all</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const bk = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1F1F1F",
    marginHorizontal: s(15),
    marginBottom: vs(6),
    borderRadius: s(12),
    paddingHorizontal: s(18),
    paddingVertical: vs(10),
    elevation: 6,
  },
  left: { flexDirection: "row", alignItems: "center", gap: s(10) },
  badge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: s(10),
    paddingHorizontal: s(9),
    paddingVertical: vs(3),
    minWidth: s(26),
    alignItems: "center",
  },
  num: { color: "#fff", fontWeight: "800", fontSize: ms(13) },
  label: {
    color: "rgba(255,255,255,0.85)",
    fontSize: ms(13),
    fontWeight: "500",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    backgroundColor: "#6D4AFF",
    paddingHorizontal: s(14),
    paddingVertical: vs(8),
    borderRadius: s(8),
  },
  btnTxt: { color: "#ffffff", fontWeight: "600", fontSize: ms(13) },
});

// ─── ChatListScreen ───────────────────────────────────────────────────────────
export default function ChatListScreen() {
  const { user } = useAuthh();

  // CHANGE 3: Runtime safe area inset for list bottom padding
  const insets = useSafeAreaInsets();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuSheet, setMenuSheet] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<Friend | null>(null);
  const [clearModal, setClearModal] = useState<Friend | null>(null);

  const listKeyRef = useRef(0);
  const friendsRef = useRef<Friend[]>([]);
  const allFriendsRef = useRef<Friend[]>([]);
  const isFirstFocus = useRef(true);
  const closeRegistry = useRef<Map<string, () => void>>(new Map());
  const channelRef = useRef<any>(null);
  const localZeroedChats = useRef<Set<string>>(new Set());

  const registerClose = useCallback((id: string, fn: () => void) => {
    closeRegistry.current.set(id, fn);
  }, []);

  const closeAllExcept = useCallback((exceptId?: string) => {
    closeRegistry.current.forEach((fn, id) => {
      if (id !== exceptId) fn();
    });
  }, []);

  const onSwipeLeftOpen = useCallback(
    (id: string) => setSwipedIds((p) => new Set([...p, id])),
    [],
  );

  const onSwipeLeftClose = useCallback(
    (id: string) =>
      setSwipedIds((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      }),
    [],
  );

  // ─── fetchFresh ─────────────────────────────────────────────────────────────
  const fetchFresh = useCallback(async (): Promise<Friend[]> => {
    if (!user?.id) return [];
    const uid = user.id;

    const [sent, recv] = await Promise.all([
      supabase
        .from(TABLES.connections)
        .select("id,receiver_id")
        .eq("sender_id", uid)
        .eq("status", "accepted")
        .limit(200),
      supabase
        .from(TABLES.connections)
        .select("id,sender_id")
        .eq("receiver_id", uid)
        .eq("status", "accepted")
        .limit(200),
    ]);

    const conns = [
      ...(sent.data ?? []).map((d: any) => ({
        connId: d.id,
        otherId: d.receiver_id,
      })),
      ...(recv.data ?? []).map((d: any) => ({
        connId: d.id,
        otherId: d.sender_id,
      })),
    ].filter((c) => c.otherId);

    if (!conns.length) return [];

    const otherIds = conns.map((c) => c.otherId);

    const [profilesRes, chatsRes] = await Promise.all([
      supabase
        .from(TABLES.users)
        .select(
          "user_id,full_name,profile_image,location,skills,last_seen,is_online",
        )
        .in("user_id", otherIds)
        .limit(200),
      supabase
        .from(TABLES.chats)
        .select(
          "id,participants,last_message,last_message_at,last_sender_id,last_message_status,hidden_for,unread_p1,unread_p2,cleared_at_p1,cleared_at_p2,last_message_p1,last_message_p2,last_message_at_p1,last_message_at_p2,last_sender_id_p1,last_sender_id_p2",
        )
        .contains("participants", [uid])
        .order("last_message_at", { ascending: false })
        .limit(200),
    ]);

    const pm: Record<string, any> = {};
    (profilesRes.data ?? []).forEach((p: any) => {
      pm[p.user_id] = p;
    });

    const cm: Record<string, any> = {};
    (chatsRes.data ?? []).forEach((c: any) => {
      const other = (c.participants as string[])?.find((p) => p !== uid);
      if (other) cm[other] = c;
    });

    const result: Friend[] = conns.map(({ connId, otherId }) => {
      const p = pm[otherId];
      const ch = cm[otherId];

      const isHidden = ch ? (ch.hidden_for ?? []).includes(uid) : false;
      const parts = (ch?.participants as string[]) ?? [];
      const myIndex = parts.indexOf(uid);
      const myClearedAt =
        myIndex === 0
          ? (ch?.cleared_at_p1 ?? null)
          : myIndex === 1
            ? (ch?.cleared_at_p2 ?? null)
            : null;
      const lastMsgAt = ch?.last_message_at ?? null;
      // In your realtime handler — this runs for User B too:
      const userHasCleared =
        myClearedAt && lastMsgAt
          ? new Date(myClearedAt) >= new Date(lastMsgAt)
          : !!myClearedAt && !lastMsgAt;
      const showEmptyPreview = isHidden || userHasCleared;

      const unread_count = showEmptyPreview
        ? 0
        : myIndex === 0
          ? (ch?.unread_p1 ?? 0)
          : myIndex === 1
            ? (ch?.unread_p2 ?? 0)
            : 0;

      if (__DEV__ && myClearedAt) {
        console.log(
          `[fetchFresh] ${otherId.slice(0, 8)} cleared_at=${myClearedAt} lastMsg=${lastMsgAt} showEmpty=${showEmptyPreview}`,
        );
      }

      const myPreview =
        myIndex === 0
          ? (ch?.last_message_p1 ?? null)
          : (ch?.last_message_p2 ?? null);
      const myPreviewAt =
        myIndex === 0
          ? (ch?.last_message_at_p1 ?? null)
          : (ch?.last_message_at_p2 ?? null);
      const myPreviewSdr =
        myIndex === 0
          ? (ch?.last_sender_id_p1 ?? null)
          : (ch?.last_sender_id_p2 ?? null);

      return {
        connection_id: connId,
        user_id: otherId,
        full_name: p?.full_name ?? "Unknown",
        profile_image: p?.profile_image ?? null,
        location: p?.location ?? "",
        skills: p?.skills ?? "",
        last_seen: p?.last_seen ?? null,
        chat_id: ch?.id ?? undefined,
        last_message: showEmptyPreview ? null : (myPreview ?? null),
        last_message_at: showEmptyPreview ? null : (myPreviewAt ?? null),
        last_message_is_mine: showEmptyPreview ? false : myPreviewSdr === uid,
        last_message_status: showEmptyPreview
          ? "sent"
          : ((ch?.last_message_status ?? "sent") as "sent" | "seen"),
        is_hidden: isHidden,
        unread_count,
        cleared_at_p1: ch?.cleared_at_p1 ?? null,
        cleared_at_p2: ch?.cleared_at_p2 ?? null,
      };
    });

    return sortFriends(result);
  }, [user?.id]);

  // ─── loadFriends ────────────────────────────────────────────────────────────
  const loadFriends = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) return;
      if (isRefresh) setRefreshing(true);

      if (!isRefresh) {
        const raw = await cacheGet(CACHE_KEY(user.id));
        if (raw) {
          try {
            const { data, at } = JSON.parse(raw);
            if (Date.now() - at < CACHE_TTL && data.length) {
              const sorted = sortFriends(data);
              const visible = sorted.filter((f: any) => !f.is_hidden);
              allFriendsRef.current = sorted;
              setFriends(visible);
              friendsRef.current = visible;
              setLoading(false);
            }
          } catch {}
        }
      }

      try {
        const allFresh = sortFriends(await fetchFresh());
        const visible = allFresh.filter((f: any) => !f.is_hidden);
        allFriendsRef.current = allFresh;
        setFriends((prev) => {
          if (orderChanged(prev, visible)) listKeyRef.current += 1;
          friendsRef.current = visible;
          return visible;
        });
        cacheSet(
          CACHE_KEY(user.id),
          JSON.stringify({ data: allFresh, at: Date.now() }),
        );
      } catch (e: any) {
        console.error("loadFriends:", e?.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id, fetchFresh],
  );

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  // ─── Focus refresh ──────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      fetchFresh()
        .then((fresh) => {
          if (!fresh.length) return;
          const corrected = fresh.map((f) =>
            f.chat_id && localZeroedChats.current.has(f.chat_id)
              ? { ...f, unread_count: 0 }
              : f,
          );
          const allSorted = sortFriends(corrected);
          const visible = allSorted.filter((f) => !f.is_hidden);
          allFriendsRef.current = allSorted;
          setFriends((prev) => {
            if (orderChanged(prev, visible)) listKeyRef.current += 1;
            friendsRef.current = visible;
            return visible;
          });
        })
        .catch(() => {});
    }, [fetchFresh]),
  );

  // ─── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const timer = setTimeout(() => {
      const channel = supabase
        .channel(`home_${uid}_${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "chats" },
          (payload: any) => {
            const doc = payload.new as any;
            const parts = (doc.participants ?? []) as string[];
            if (!parts.includes(uid)) return;

            const otherId = parts.find((p: string) => p !== uid);
            if (!otherId) return;

            const isHiddenForMe = (doc.hidden_for ?? []).includes(uid);
            const myIndex = parts.indexOf(uid);
            const myClearedAt =
              myIndex === 0 ? doc.cleared_at_p1 : doc.cleared_at_p2;
            const lastMsgAt = doc.last_message_at;
            const userHasCleared =
              myClearedAt && lastMsgAt
                ? new Date(myClearedAt) >= new Date(lastMsgAt)
                : !!myClearedAt && !lastMsgAt;

            const unread_count =
              isHiddenForMe || userHasCleared
                ? 0
                : myIndex === 0
                  ? (doc.unread_p1 ?? 0)
                  : (doc.unread_p2 ?? 0);

            if (unread_count === 0 && doc.id)
              localZeroedChats.current.delete(doc.id);

            if (isHiddenForMe) {
              setFriends((prev) => {
                const next = prev.filter((f) => f.user_id !== otherId);
                friendsRef.current = next;
                listKeyRef.current += 1;
                return next;
              });
              allFriendsRef.current = allFriendsRef.current.map((f) =>
                f.user_id === otherId ? { ...f, is_hidden: true } : f,
              );
              return;
            }

            const myPreview =
              myIndex === 0 ? doc.last_message_p1 : doc.last_message_p2;
            const myPreviewAt =
              myIndex === 0 ? doc.last_message_at_p1 : doc.last_message_at_p2;
            const myPreviewSdr =
              myIndex === 0 ? doc.last_sender_id_p1 : doc.last_sender_id_p2;

            const updatedFields = {
              chat_id: doc.id,
              last_message: userHasCleared ? null : (myPreview ?? ""),
              last_message_at: userHasCleared ? null : (myPreviewAt ?? null),
              last_message_is_mine: userHasCleared
                ? false
                : myPreviewSdr === uid,
              last_message_status: userHasCleared
                ? "sent"
                : ((doc.last_message_status ?? "sent") as "sent" | "seen"),
              unread_count,
              is_hidden: false,
              cleared_at_p1: doc.cleared_at_p1 ?? null,
              cleared_at_p2: doc.cleared_at_p2 ?? null,
            };

            setFriends((prev) => {
              const idx = prev.findIndex((f) => f.user_id === otherId);
              let next: Friend[];
              if (idx !== -1) {
                next = [...prev];
                next[idx] = { ...next[idx], ...updatedFields };
              } else {
                const hiddenFriend = allFriendsRef.current.find(
                  (f) => f.user_id === otherId,
                );
                if (hiddenFriend) {
                  next = [{ ...hiddenFriend, ...updatedFields }, ...prev];
                  listKeyRef.current += 1;
                } else {
                  loadFriends();
                  return prev;
                }
              }
              return sortFriends(next);
            });

            allFriendsRef.current = allFriendsRef.current.map((f) =>
              f.user_id === otherId ? { ...f, ...updatedFields } : f,
            );
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chats" },
          (payload: any) => {
            if ((payload.new?.participants as string[])?.includes(uid))
              loadFriends();
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "users" },
          (payload: any) => {
            const doc = payload.new as { user_id: string; last_seen: string };
            setFriends((prev) => {
              const idx = prev.findIndex((f) => f.user_id === doc.user_id);
              if (idx === -1) return prev;
              const next = [...prev];
              next[idx] = { ...next[idx], last_seen: doc.last_seen };
              return next;
            });
          },
        )
        .subscribe((status: string) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
            loadFriends();
        });

      channelRef.current = channel;
    }, 100);

    return () => {
      clearTimeout(timer);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  // ─── Mark read ──────────────────────────────────────────────────────────────
  const markReadLocally = useCallback((chatId: string) => {
    localZeroedChats.current.add(chatId);
    setFriends((prev) => {
      const next = prev.map((f) =>
        f.chat_id === chatId ? { ...f, unread_count: 0 } : f,
      );
      friendsRef.current = next;
      return next;
    });
  }, []);

  // ─── Clear chat ─────────────────────────────────────────────────────────────
  const handleClear = useCallback((f: Friend) => {
    if (!f.chat_id) return;
    setClearModal(f);
  }, []);

  const doClearChat = useCallback(
    async (f: Friend) => {
      const clearedFriend: Friend = {
        ...f,
        last_message: null,
        last_message_at: null,
        unread_count: 0,
        is_hidden: false,
      };
      setFriends((prev) => {
        const next = prev.map((x) =>
          x.connection_id === f.connection_id ? clearedFriend : x,
        );
        friendsRef.current = next;
        return next;
      });
      allFriendsRef.current = allFriendsRef.current.map((x) =>
        x.connection_id === f.connection_id ? clearedFriend : x,
      );
      try {
        await callFn({ action: "clear_chat", chatId: f.chat_id });
      } catch (e: any) {
        console.error("clear_chat failed:", e?.message);
        loadFriends();
      }
    },
    [loadFriends],
  );

  // ─── Hide / delete chat ─────────────────────────────────────────────────────
  const handleDelete = useCallback((f: Friend) => {
    setDeleteModal(f);
  }, []);

  const doHideChat = useCallback(async (f: Friend) => {
    setFriends((prev) => {
      const next = prev.filter((x) => x.connection_id !== f.connection_id);
      friendsRef.current = next;
      listKeyRef.current += 1;
      return next;
    });
    setSwipedIds((prev) => {
      const n = new Set(prev);
      n.delete(f.connection_id);
      return n;
    });
    allFriendsRef.current = allFriendsRef.current.map((x) =>
      x.connection_id === f.connection_id
        ? { ...x, is_hidden: true, last_message: null, last_message_at: null }
        : x,
    );
    if (!f.chat_id) return;
    try {
      await callFn({ action: "hide_chat", chatId: f.chat_id });
    } catch {
      setFriends((prev) => sortFriends([{ ...f, is_hidden: false }, ...prev]));
      listKeyRef.current += 1;
    }
  }, []);

  // ─── Bulk delete ─────────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(swipedIds);
    const targets = friends.filter((f) => ids.includes(f.connection_id));
    setFriends((prev) => prev.filter((f) => !ids.includes(f.connection_id)));
    setSwipedIds(new Set());
    closeAllExcept();
    listKeyRef.current += 1;
    await Promise.all(targets.map((f) => doHideChat(f)));
  }, [swipedIds, friends, doHideChat, closeAllExcept]);

  const keyExtractor = useCallback((item: Friend) => item.connection_id, []);

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loading && !friends.length)
    return (
      <SafeAreaView style={st.safe} edges={["top"]}>
        <Header onSearch={() => setSearchOpen(true)} onMenuPress={() => {}} />
        <SkeletonRow />
        <SkeletonRow opacity={0.75} />
        <SkeletonRow opacity={0.5} />
        <SkeletonRow opacity={0.3} />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={st.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <Header
        onSearch={() => setSearchOpen(true)}
        onMenuPress={() => setMenuSheet(true)}
      />
      <BulkDeleteBar count={swipedIds.size} onDeleteAll={handleBulkDelete} />

      <FlatList
        key={String(listKeyRef.current)}
        data={friends}
        renderItem={({ item }) => (
          <SwipeableRow
            item={item}
            onDelete={handleDelete}
            onClear={handleClear}
            onSwipeLeftOpen={onSwipeLeftOpen}
            onSwipeLeftClose={onSwipeLeftClose}
            registerClose={registerClose}
            onAnyPress={(id) => closeAllExcept(id)}
            onMarkRead={markReadLocally}
          />
        )}
        keyExtractor={keyExtractor}
        extraData={friends}
        contentContainerStyle={[
          st.listContent,
          { paddingBottom: insets.bottom + vs(80) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        directionalLockEnabled
        onScrollBeginDrag={() => closeAllExcept()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadFriends(true)}
            tintColor={C.purple}
            colors={[C.purple]}
          />
        }
        ListEmptyComponent={
          <View style={st.empty}>
            <View style={st.emptyIcon}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={s(36)}
                color={C.purple}
              />
            </View>

            <Text style={st.emptyTitle}>No connections yet</Text>
            <Text style={st.emptySub}>
              Accept a connection request{"\n"}to start chatting
            </Text>
            <TouchableOpacity
              style={st.discoverBtn}
              onPress={() => router.push("/(tabs)/search")}
            >
              <Text style={st.discoverTxt}>Discover People</Text>
            </TouchableOpacity>
          </View>
        }
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
      />

      <FriendsSearchModal
        visible={searchOpen}
        friends={allFriendsRef.current}
        onClose={() => setSearchOpen(false)}
      />

      <ChatMenuSheet
        visible={menuSheet}
        onClose={() => setMenuSheet(false)}
        items={[
          {
            icon: "settings",
            label: "Settings",
            onPress: () => router.push("/subScreens/Settings"),
          },
        ]}
      />

      <ConfirmModal
        visible={!!clearModal}
        title="Clear Chat?"
        message={`Clear all messages with ${clearModal?.full_name ?? "this person"}? The chat will stay in your list.`}
        confirmLabel="Clear Messages"
        cancelLabel="Cancel"
        confirmDestructive
        icon="chatbubble-ellipses-outline"
        onConfirm={() => {
          const f = clearModal!;
          setClearModal(null);
          doClearChat(f);
        }}
        onCancel={() => setClearModal(null)}
      />

      <ConfirmModal
        visible={!!deleteModal}
        title="Delete Chat?"
        message={`Remove your conversation with ${deleteModal?.full_name ?? "this person"}? This only affects your view.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmDestructive
        icon="trash-outline"
        onConfirm={() => {
          const f = deleteModal!;
          setDeleteModal(null);
          doHideChat(f);
        }}
        onCancel={() => setDeleteModal(null)}
      />
       <CommunityGuidelinesSheet />
    </SafeAreaView>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
const Header = ({
  onSearch,
  onMenuPress,
}: {
  onSearch: () => void;
  onMenuPress: () => void;
}) => (
  <View style={st.header}>
    <Text style={st.headerTitle}>MindMates</Text>
    <View style={{ flex: 1 }} />
    <TouchableOpacity onPress={onSearch} style={st.headerIconBtn}>
      <Ionicons name="search-outline" size={s(20)} color={C.text} />
    </TouchableOpacity>
    <TouchableOpacity onPress={onMenuPress} style={st.headerIconBtn}>
      <Ionicons
        name="ellipsis-vertical"
        size={s(20)}
        color={C.text}
        style={{ marginLeft: 16, left: s(7) }}
      />
    </TouchableOpacity>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  listContent: {},
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(20),
    paddingVertical: vs(15),
    backgroundColor: C.white,
  },
  headerTitle: {
    fontSize: s(25),
    fontWeight: "700",
    color: C.purple,
    alignItems: "center",
  },
  headerIconBtn: {
    padding: s(5),
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    alignItems: "center",
    paddingTop: vs(100),
    paddingHorizontal: s(40),
  },
  emptyIcon: {
    width: s(70),
    height: s(70),
    borderRadius: s(35),
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: vs(8),
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.title,
    fontWeight: "700",
    color: C.text,
    marginBottom: vs(6),
  },

  // CHANGE 4: bottom: vs(8) removed
  emptySub: {
    fontSize: TYPOGRAPHY.body,
    color: C.muted,
    textAlign: "center",
    lineHeight: ms(21),
    marginBottom: vs(10),
  },
  discoverBtn: {
    backgroundColor: C.purple,
    paddingHorizontal: s(22),
    paddingVertical: vs(12),
    borderRadius: s(12),
  },
  discoverTxt: { color: "#fff", fontWeight: "700", fontSize: TYPOGRAPHY.body },
});
