import { ProfileAvatar } from "@/components/Profileavatar";
import { useAuthh } from "@/Contexts/authContext";
import { useConnection } from "@/hooks/useConnection";
import { supabase } from "@/lib/supabase";
import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

interface SearchUser {
  user_id: string;
  full_name: string;
  location: string;
  bio: string;
  profile_image: string | null;
  skills: string;
}
type FilterTab = "people" | "skills" | "location";

const C = {
  bg: "#F7F8FA",
  white: "#FFFFFF",
  purple: "#6D4AFF",
  purpleL: "#EDE9FE",
  text: "#303032",
  muted: "#6B7280",
  border: "#EAECF0",
  skeleton: "#F0F0F3",
};

const LIMIT = 20;
const DEBOUNCE = 400;
const CARD_H = vs(75);
const TAB_ROW_H = vs(48);

const TABS: {
  key: FilterTab;
  label: string;
  icon: string;
  placeholder: string;
}[] = [
  {
    key: "people",
    label: "People",
    icon: "person-outline",
    placeholder: "Search by name...",
  },
  {
    key: "skills",
    label: "Skills",
    icon: "code-slash-outline",
    placeholder: "Search by skill...",
  },
  {
    key: "location",
    label: "Location",
    icon: "location-outline",
    placeholder: "Search by city...",
  },
];

const parseSkills = (sk: string | null): string[] =>
  sk
    ? sk
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

const rowToUser = (row: any): SearchUser => ({
  user_id: row.user_id ?? "",
  full_name: row.full_name ?? "",
  location: row.location ?? "",
  bio: row.bio ?? "",
  profile_image: row.profile_image ?? null,
  skills: row.skills ?? "",
});

const SkeletonCard = ({ opacity = 1 }: { opacity?: number }) => (
  <View style={[st.card, { opacity }]}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: s(12) }}>
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
            height: vs(13),
            width: "50%",
            backgroundColor: C.skeleton,
            borderRadius: s(6),
          }}
        />
        <View
          style={{
            height: vs(11),
            width: "35%",
            backgroundColor: C.skeleton,
            borderRadius: s(6),
          }}
        />
        <View
          style={{
            height: vs(11),
            width: "65%",
            backgroundColor: C.skeleton,
            borderRadius: s(6),
          }}
        />
      </View>
      <View
        style={{
          width: s(80),
          height: vs(32),
          backgroundColor: C.skeleton,
          borderRadius: s(20),
        }}
      />
    </View>
  </View>
);

const ConnectButton = React.memo(
  ({
    user_id,
    full_name,
    profile_image,
    skills,
  }: {
    user_id: string;
    full_name: string;
    profile_image: string | null;
    skills: string;
  }) => {
    const { getStatus, isLoading, sendRequest, cancelRequest } =
      useConnection();
    const status = getStatus(user_id);
    const loading = isLoading(user_id);
    const cfg = {
      none: { label: "Connect", bg: C.purple, fg: "#fff", border: C.purple },
      pending: {
        label: "Requested",
        bg: C.white,
        fg: "#6D4AFF",
        border: "#6D4AFF",
      },
      accepted: {
        label: "Connected",
        bg: "#F0FDF4",
        fg: "#16A34A",
        border: "#16A34A",
      },
      rejected: {
        label: "Connect",
        bg: C.purple,
        fg: "#fff",
        border: C.purple,
      },
    }[status];

    const handlePress = () => {
      if (loading || status === "accepted") return;
      if (status === "none" || status === "rejected")
        sendRequest({
          userId: user_id,
          fullName: full_name,
          profileImage: profile_image,
          skills,
        });
      else if (status === "pending") cancelRequest(user_id);
    };

    return (
      <TouchableOpacity
        style={[
          st.connectBtn,
          { backgroundColor: cfg.bg, borderColor: cfg.border },
        ]}
        activeOpacity={status === "accepted" ? 1 : 0.82}
        onPress={handlePress}
        disabled={loading || status === "accepted"}
      >
        {loading ? (
          <ActivityIndicator size="small" color={cfg.fg} />
        ) : (
          <Text style={[st.connectText, { color: cfg.fg }]}>{cfg.label}</Text>
        )}
      </TouchableOpacity>
    );
  },
);
const UserCard = React.memo(({ item }: { item: SearchUser }) => {
  const skillDots = useMemo(
    () => parseSkills(item.skills).slice(0, 3).join(" · "),
    [item.skills],
  );
  return (
    <TouchableOpacity
      style={st.card}
      activeOpacity={0.82}
      onPress={() =>
        router.push({
          pathname: "/subScreens/userProfile",
          params: { userId: item.user_id },
        })
      }
    >
      <View style={st.cardRow}>
        <ProfileAvatar
          uri={item.profile_image}
          name={item.full_name}
          size={s(52)}
        />
        <View style={st.info}>
          <Text style={st.name} numberOfLines={1}>
            {item.full_name}
          </Text>
          {!!item.location && (
            <View style={st.locRow}>
              <Ionicons name="location-sharp" size={s(11)} color={C.muted} />
              <Text style={st.locText} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          )}
          {!!skillDots && (
            <Text style={st.skills} numberOfLines={1}>
              {skillDots}
            </Text>
          )}
        </View>
        <ConnectButton
          user_id={item.user_id}
          full_name={item.full_name}
          profile_image={item.profile_image}
          skills={item.skills}
        />
      </View>
    </TouchableOpacity>
  );
});
const EmptyState = React.memo(
  ({
    query,
    filter,
    error,
  }: {
    query: string;
    filter: FilterTab;
    error: string | null;
  }) => (
    <View style={st.empty}>
      {error ? (
        <>
          <Ionicons
            name="alert-circle-outline"
            size={s(44)}
            color={C.muted}
            style={{ marginBottom: vs(14) }}
          />
          <Text style={st.emptyTitle}>Something went wrong</Text>
          <Text style={st.emptySub}>{error}</Text>
        </>
      ) : query.trim().length === 0 ? (
        <>
          <Ionicons
            name="search-outline"
            size={s(52)}
            color={C.purple}
            style={{ marginBottom: vs(14), opacity: 0.55 }}
          />
          <Text style={st.emptyTitle}>Find your Mindmates</Text>
          <Text style={st.emptySub}>
            {filter === "people"
              ? "Type a name to find people"
              : filter === "skills"
                ? "Type a skill (e.g. Python)"
                : "Type a city or location"}
          </Text>
        </>
      ) : query.trim().length < 2 ? (
        <>
          <Ionicons
            name="pencil-outline"
            size={s(36)}
            color={C.muted}
            style={{ marginBottom: vs(10) }}
          />
          <Text style={st.emptySub}>Keep typing…</Text>
        </>
      ) : (
        <>
          <Ionicons
            name="person-outline"
            size={s(40)}
            color={C.muted}
            style={{ marginBottom: vs(12) }}
          />
          <Text style={st.emptyTitle}>No results for "{query}"</Text>
          <Text style={st.emptySub}>
            Try a different{" "}
            {filter === "people"
              ? "name"
              : filter === "skills"
                ? "skill"
                : "location"}
          </Text>
        </>
      )}
    </View>
  ),
);
export default function SearchScreen() {
  const { user } = useAuthh();
  const { loadStatuses } = useConnection();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterTab>("people");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const tabsVisible = useSharedValue(0);
  const isFocused = useRef(false);
  const lastScrollY = useRef(0);
  const scrollDown = useRef(false);
  const showTabs = useCallback(() => {
    tabsVisible.value = withSpring(1, {
      damping: 400,
      stiffness: 300,
      mass: 0.8,
    });
  }, []);
  const hideTabs = useCallback(() => {
    tabsVisible.value = withTiming(0, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
  }, []);

  const tabsAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(tabsVisible.value, [0, 1], [-TAB_ROW_H, 0]) },
    ],
    opacity: interpolate(tabsVisible.value, [0, 0.5, 1], [0, 0.7, 1]),
    maxHeight: interpolate(tabsVisible.value, [0, 1], [0, TAB_ROW_H]),
  }));

  const handleFocus = () => {
    isFocused.current = true;
    showTabs();
  };
  const handleBlur = () => {
    isFocused.current = false;
    if (scrollDown.current) hideTabs();
  };

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const diff = y - lastScrollY.current;
      lastScrollY.current = y;
      if (diff > 4 && y > 30) {
        scrollDown.current = true;
        if (!isFocused.current) hideTabs();
      } else if (diff < -4) {
        scrollDown.current = false;
        showTabs();
      }
    },
    [showTabs, hideTabs],
  );

  const fetchUsers = useCallback(
    async (q: string, tab: FilterTab, pageOffset: number) => {
      if (!user?.id || running.current) return;
      const trimmed = q.trim();
      if (trimmed.length < 2) return;
      running.current = true;
      if (pageOffset === 0) {
        setLoading(true);
        setError(null);
      }
      try {
        let qb = supabase
          .from("users")
          .select("user_id, full_name, profile_image, location, skills, bio")
          .eq("is_profile_complete", true)
          .neq("user_id", user.id)
          .range(pageOffset, pageOffset + LIMIT - 1);
        if (tab === "people") qb = qb.ilike("full_name", `%${trimmed}%`);
        if (tab === "skills") qb = qb.ilike("skills", `%${trimmed}%`);
        if (tab === "location") qb = qb.ilike("location", `%${trimmed}%`);
        const { data, error: qErr } = await qb;
        if (qErr) {
          setError(qErr.message);
          return;
        }
        const results = (data ?? []).map(rowToUser);
        if (pageOffset === 0) setUsers(results);
        else
          setUsers((prev: any) => {
            const ids = new Set(prev.map((u: any) => u.user_id));
            return [
              ...prev,
              ...results.filter((u: any) => !ids.has(u.user_id)),
            ];
          });
        setOffset(pageOffset + LIMIT);
        setHasMore(results.length === LIMIT);
        setError(null);
        if (results.length > 0)
          loadStatuses(results.map((u: any) => u.user_id)).catch(() => {});
      } catch {
        setError("Could not load users. Try again.");
      } finally {
        setLoading(false);
        running.current = false;
      }
    },
    [user?.id, loadStatuses],
  );

  useEffect(() => {
  const t = setTimeout(() => inputRef.current?.focus(), 150);
  return () => clearTimeout(t);
}, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length === 0) {
      setUsers([]);
      setOffset(0);
      setHasMore(false);
      setLoading(false);
      running.current = false;
      return;
    }
    if (q.length < 2) return;
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      running.current = false;
      fetchUsers(q, filter, 0);
    }, DEBOUNCE);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filter, fetchUsers]);

  const handleFilterChange = (f: FilterTab) => {
    setFilter(f);
    if (query.trim().length >= 2) {
      setOffset(0);
      running.current = false;
      fetchUsers(query.trim(), f, 0);
    }
  };
  const handleChangeText = (text: string) => {
    setQuery(text);
    showTabs();
  };
  const loadMore = useCallback(() => {
    if (running.current || !hasMore || query.trim().length < 2) return;
    fetchUsers(query.trim(), filter, offset);
  }, [query, filter, offset, hasMore, fetchUsers]);

  const keyExtractor = useCallback((item: SearchUser) => item.user_id, []);
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CARD_H,
      offset: CARD_H * index,
      index,
    }),
    [],
  );
  const renderItem = useCallback(
    ({ item }: { item: SearchUser }) => <UserCard item={item} />,
    [],
  );
  const placeholder =
    TABS.find((t) => t.key === filter)?.placeholder ?? "Search...";

  return (
    <SafeAreaView style={st.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <View style={st.headerWrap}>
        <View style={st.searchRow}>
          <View style={st.searchBar}>
            {loading ? (
              <ActivityIndicator size="small" color={C.purple} />
            ) : (
              <Ionicons name="search" size={s(21)} color={C.muted} />
            )}
            <TextInput
              ref={inputRef}
              style={st.searchInput}
              placeholder={placeholder}
              placeholderTextColor={C.muted}
              value={query}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={s(18)} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={st.tabsClip}>
          <Animated.View style={tabsAnimStyle}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.tabsScroll}
              keyboardShouldPersistTaps="handled"
            >
              {TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[st.tab, filter === tab.key && st.tabActive]}
                  onPress={() => handleFilterChange(tab.key)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={s(14)}
                    color={filter === tab.key ? "#fff" : C.muted}
                  />
                  <Text
                    style={[st.tabText, filter === tab.key && st.tabTextActive]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </View>

      {loading && users.length === 0 ? (
        <View style={{ paddingTop: vs(8) }}>
          <SkeletonCard />
          <SkeletonCard opacity={0.7} />
          <SkeletonCard opacity={0.4} />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          contentContainerStyle={{ paddingBottom: vs(120) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            <EmptyState query={query} filter={filter} error={error} />
          }
          ListFooterComponent={
            hasMore && users.length > 0 ? (
              <ActivityIndicator color={C.purple} style={{ padding: vs(20) }} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  headerWrap: {
    backgroundColor: C.white,
    paddingTop: vs(9),
    paddingBottom: vs(4),
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(12),
    marginBottom: vs(1),
    gap: s(8),
  },

  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: s(5),
    backgroundColor: C.bg,
    borderRadius: s(50),
    paddingHorizontal: s(15),
    height: vs(42),
    marginHorizontal: s(17),
  },
  searchInput: {
    flex: 1,
    fontSize: ms(14),
    color: C.text,
  },
  tabsClip: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },

  tabsScroll: {
    paddingHorizontal: s(16),
    paddingBottom: vs(6),
    paddingTop: vs(4),
    gap: s(8),
    flexDirection: "row",
    alignItems: "center",
  },

  tab: {
    flexDirection: "row",
    gap: s(6),
    paddingHorizontal: s(14),
    paddingVertical: vs(7),
    borderRadius: s(20),
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: C.purple, borderColor: C.purple },
  tabText: { fontSize: ms(12), fontWeight: "600", color: C.muted },
  tabTextActive: { color: "#fff" },
  card: {
    backgroundColor: C.white,
    paddingHorizontal: s(16),
    paddingVertical: vs(6),
    height: CARD_H,
  },

  cardRow: { flexDirection: "row", alignItems: "center", gap: s(12) },
  info: { flex: 1 },
  name: {
    fontSize: ms(14),
    fontWeight: "600",
    color: C.text,
    marginBottom: vs(3),
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(3),
    marginBottom: vs(2),
  },
  locText: { fontSize: ms(12), color: C.muted },
  skills: {
    fontSize: ms(12),
    color: C.purple,
    fontWeight: "500",
    marginTop: vs(2),
  },

  connectBtn: {
    paddingHorizontal: s(8),
    paddingVertical: vs(8),
    borderRadius: s(10),
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    minWidth: s(83),
  },
  connectText: { fontWeight: "700", fontSize: ms(12) },

  empty: {
    alignItems: "center",
    paddingTop: vs(80),
    paddingHorizontal: s(32),
  },
  emptyTitle: {
    fontSize: ms(16),
    fontWeight: "600",
    color: C.text,
    marginBottom: vs(4),
    textAlign: "center",
  },
  emptySub: {
    fontSize: ms(13),
    color: C.muted,
    textAlign: "center",
    lineHeight: ms(21),
  },
});