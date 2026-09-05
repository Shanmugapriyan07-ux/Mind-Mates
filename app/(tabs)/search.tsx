import { ProfileAvatar } from "@/components/Profileavatar";
import images from "@/constants/images";
import { useAuthh } from "@/Contexts/authContext";
import { useConnection } from "@/hooks/useConnection";
import { MatchUser, useMatches } from "@/hooks/useMatches";
import { TYPOGRAPHY } from "@/theme";
import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo } from "react";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRenderCount } from "@/Count";
const C = {
  bg: "#F7F8FA",
  white: "#FFFFFF",
  purple: "#6D4AFF",
  purpleL: "#EDE9FE",
  purpleD: "#5538E5",
  text: "#0F0F10",
  muted: "#6b6b6d",
  border: "#EAECF0",
  green: "#16A34A",
  greenL: "#F0FDF4",
  orange: "#6D4AFF",
  skeleton: "#F0F0F3",
};


const CARD_H = vs(75);

const SkeletonCard = ({ opacity = 1 }: { opacity?: number }) => (
  <View style={[st.card, { opacity }]}>
    <View style={st.cardRow}>
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
          width: s(88),
          height: vs(34),
          backgroundColor: C.skeleton,
          borderRadius: s(20),
        }}
      />
    </View>
  </View>
);
const ConnectButton = React.memo(function ConnectButton({
  userId,
  fullName,
  profileImage,
  skills,
  location,
}: {
  userId: string;
  fullName: string;
  profileImage: string | null;
  skills: string;
  location: string;
}) {
  const { getStatus, isLoading, sendRequest, cancelRequest } = useConnection();
  const status = getStatus(userId);
  const loading = isLoading(userId);
  const cfg = {
    none: { label: "Connect", bg: C.purple, fg: "#fff", border: C.purple },
    pending: {
      label: "Requested",
      bg: C.white,
      fg: C.orange,
      border: C.orange,
    },
    accepted: {
      label: "Connected",
      bg: C.greenL,
      fg: C.green,
      border: C.greenL,
    },
    rejected: { label: "Connect", bg: C.purple, fg: "#fff", border: C.purple },
  }[status];

  return (
    <TouchableOpacity
      style={[
        st.connectBtn,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
      ]}
      onPress={() => {
        if (loading || status === "accepted") return;
        if (status === "none" || status === "rejected") {
          sendRequest({ userId, fullName, profileImage, skills, location });
        } else {
          cancelRequest(userId);
        }
      }}
      disabled={loading || status === "accepted"}
      activeOpacity={status === "accepted" ? 1 : 0.82}
    >
      {loading ? (
        <ActivityIndicator size="small" color={cfg.fg} />
      ) : (
        <Text style={[st.connectText, { color: cfg.fg }]}>{cfg.label}</Text>
      )}
    </TouchableOpacity>
  );
});

const MatchCard = React.memo(({ item }: { item: MatchUser }) => {
  const skillsStr = item.skillsArray?.join(",") ?? "";
  const commonSkills = item.commonSkills ?? [];
  const allSkills = item.skillsArray ?? [];
  const commonDots = commonSkills.slice(0, 3).join(" · ");
  const extraCount = allSkills.length - commonSkills.length;

  return (
    <TouchableOpacity
      style={st.card}
      activeOpacity={0.82}
      onPress={() =>
        router.push({
          pathname: "/subScreens/userProfile",
          params: { userId: item.userId },
        })
      }
    >
      <View style={st.cardRow}>
        <ProfileAvatar
          uri={item.profileImage}
          name={item.fullName}
          size={s(52)}
        />
        <View style={st.info}>
          <Text style={st.name} numberOfLines={1}>
            {item.fullName}
          </Text>
          {!!item.location && (
            <View style={st.locRow}>
              <Ionicons
                name="location-sharp"
                size={s(11)}
                color={item.sameCity ? C.purple : C.muted}
              />
              <Text
                style={[
                  st.locText,
                  { color: item.sameCity ? C.purple : C.muted },
                ]}
                numberOfLines={1}
              >
                {item.location}
              </Text>
            </View>
          )}
          <View style={st.skillsRow}>
            {!!commonDots && (
              <Text style={st.skillsCommon} numberOfLines={1}>
                {commonDots}
              </Text>
            )}
            {extraCount > 0 && (
              <View style={st.extraBadge}>
                <Text style={st.extraText}>+{extraCount}</Text>
              </View>
            )}
          </View>
        </View>
        <ConnectButton
          userId={item.userId}
          fullName={item.fullName}
          profileImage={item.profileImage}
          skills={skillsStr}
          location={item.location}
        />
      </View>
    </TouchableOpacity>
  );
});
export default function DiscoverScreen() {

  useRenderCount("searchScreen");
  useAuthh();
  const { loadStatuses, getStatus } = useConnection();
  const {
    matches,
    fetching,
    refreshing,
    error,
    loading,
    loadInitial,
    refresh,
    loadMore,
  } = useMatches();

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);
  useEffect(() => {
    if (matches.length > 0) loadStatuses(matches.map((m) => m.userId));
  }, [matches, loadStatuses]);

  const displayMatches = useMemo(
    () => matches.filter((m) => getStatus(m.userId) !== "accepted"),
    [matches, getStatus],
  );
  const renderItem = useCallback(
    ({ item }: { item: MatchUser }) => <MatchCard item={item} />,
    [],
  );
  const keyExtractor = useCallback((item: MatchUser) => item.userId, []);
  if (loading && matches.length === 0)
    return (
      <SafeAreaView style={st.safe} edges={["top"]}>
        <Header />
        <View style={{ paddingTop: vs(8) }}>
          <SkeletonCard opacity={1} />
          <SkeletonCard opacity={0.7} />
          <SkeletonCard opacity={0.4} />
          <SkeletonCard opacity={0.2} />
        </View>
      </SafeAreaView>
    );
  if (error && matches.length === 0)
    return (
      <SafeAreaView style={st.safe} edges={["top"]}>
        <Header />
        <View style={st.center}>
          <Text style={st.errorText}>No MindMates yet</Text>
          <TouchableOpacity style={st.retryBtn} onPress={loadInitial}>
            <Text style={st.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={st.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <Header />
      <FlashList
        data={displayMatches}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={st.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={C.purple}
            colors={[C.purple]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          fetching && matches.length > 0 ? (
            <ActivityIndicator color={C.purple} style={{ padding: vs(20) }} />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={st.center}>
              <Ionicons
                name="people"
                size={s(50)}
                color={C.purple}
                style={st.emptyIcon}
              />
              <TouchableOpacity
                style={st.retryBtn}
                onPress={() => router.push("/subScreens/searchUser")}
              >
                <Text style={st.retryText}>Find Your Mindmate</Text>
              </TouchableOpacity>
              <Text style={st.emptyTitle}>No matches yet</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
const Header = () => (
  <View style={st.header}>
    <TouchableOpacity
      style={st.searchBar}
      onPress={() => router.push("/subScreens/searchUser")}
      activeOpacity={0.8}
    >
      <Image source={images.scan} style={st.scanIcon} contentFit="contain" />
      <Text style={st.searchPlaceholder}>Search people, skills...</Text>
    </TouchableOpacity>
  </View>
);

DiscoverScreen.whyDidYouRender = true;

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  listContent: { paddingBottom: vs(120) },
  center: {
    flex: 1,
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    paddingTop: vs(80),
    paddingHorizontal: s(30),
    gap: vs(5),
  },
  header: {
    backgroundColor: C.white,
    paddingHorizontal: s(20),
    paddingTop: vs(10),
    paddingBottom: vs(9),
    borderBottomColor: C.border,
    gap: vs(10),
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.bg,
    borderRadius: s(50),
    paddingHorizontal: s(11),
    height: vs(43),
    borderWidth: 0,
    borderColor: C.border,
    marginHorizontal: s(7),
  },
  scanIcon: {
    width: s(37),
    height: s(37),
    bottom: s(1),
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: ms(TYPOGRAPHY.body),
    color: C.muted,
    fontWeight: "400",
  },
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
  locText: { fontSize: ms(TYPOGRAPHY.caption) },
  skillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    flexWrap: "nowrap",
  },
  skillsCommon: {
    fontSize: ms(12),
    fontWeight: "600",
    color: C.purple,
    flexShrink: 1,
  },
  extraBadge: {
    backgroundColor: C.bg,
    borderRadius: s(10),
    paddingHorizontal: s(7),
    paddingVertical: vs(2),
    borderWidth: 1,
    borderColor: C.border,
  },
  extraText: { fontSize: ms(11), fontWeight: "600", color: C.muted },
  connectBtn: {
    paddingHorizontal: s(8),
    paddingVertical: vs(8),
    borderRadius: s(8),
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    minWidth: s(82),
  },
  connectText: { fontWeight: "700", fontSize: ms(12) },
  errorText: {
    fontSize: ms(14),
    color: C.muted,
    textAlign: "center",
    alignSelf: "center",
  },
  emptyIcon: { marginTop: vs(7) },
  emptyTitle: {
    fontSize: ms(13),
    fontWeight: "500",
    color: C.text,
    textAlign: "center",
    marginBottom: vs(3),
    marginLeft: vs(2),
  },
  retryBtn: {
    backgroundColor: C.purple,
    paddingHorizontal: s(14),
    paddingVertical: vs(10),
    borderRadius: s(12),
    justifyContent: "center",
    alignSelf: "center",
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: ms(13) },
});
