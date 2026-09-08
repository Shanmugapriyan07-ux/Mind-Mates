import { ProfileSkeleton } from "@/components/profile/profileSkeleton";
import { ScrollablePills, SkillCard } from "@/components/profile/skillDisplay";
import { useAuthh } from "@/Contexts/authContext";
import { useProfile } from "@/Contexts/profileContext";
import { useRenderCount } from "@/Count";
import { useConnectionCount } from "@/hooks/useConnectionCount";
import { ms, s, vs } from "@/utils/scale";
import { AntDesign } from "@expo/vector-icons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
const toPublicImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.includes("/preview")) {
    const base = url.split("/preview")[0];
    const project = url.split("project=")[1]?.split("&")[0];
    return `${base}/view?project=${project}`;
  }
  return url;
};

const ProfileScreen = () => {
  useRenderCount("profileScreen");
  const { profile, isLoading, reloadProfile, error } = useProfile();
  const hasAttemptedReload = useRef(false);
  const { user } = useAuthh();
  const { count, refetch: reloadCount } = useConnectionCount(profile?.userId);
  useEffect(() => {
    if (isLoading) return;
    if (profile) return;
    if (!user?.id) return;
    if (hasAttemptedReload.current) return;
    hasAttemptedReload.current = true;
    reloadProfile();
  }, [isLoading, profile, user?.id, reloadProfile]);
  useFocusEffect(
    useCallback(() => {
      reloadCount();
    }, [reloadCount]),
  );
  if (isLoading)
    return (
      <SafeAreaView style={st.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={st.header}>
          <View style={{ width: s(32) }} />
          <Text style={st.headerTitle}>Profile</Text>
          <View style={{ width: s(32) }} />
        </View>
        <ProfileSkeleton contentPaddingBottom={vs(300)} />
      </SafeAreaView>
    );
  if (!profile)
    return (
      <SafeAreaView style={st.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={st.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <AntDesign name="arrow-left" size={s(20)} color="#232529" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>Profile</Text>
          <View style={{ width: s(32) }} />
        </View>
        <View style={st.errorState}>
          <Text style={st.errorText}>{error || "Profile not found"}</Text>
          <TouchableOpacity style={st.retryBtn} onPress={reloadProfile}>
            <Text style={st.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  const imageUrl = toPublicImageUrl(profile.profileImage);
  const skills = profile.skillsArray ?? [];
  return (
    <SafeAreaView style={st.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="chevron-back"
            size={s(18)}
            color="#17191B"
            style={{ top: s(5) }}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/subScreens/Settings")}>
          <Ionicons name="settings" size={s(15)} color="#17191B" />
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={st.avatarBlock}>
          <View style={st.avatarWrap}>
            <Pressable onPress={() => router.push("/subScreens/imagePreview")}>
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={st.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={st.avatarPlaceholder}>
                  <Text style={st.avatarPlaceholderText}>
                    {profile.fullName?.charAt(0)?.toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={st.addBadge}
              onPress={() =>
                router.push({
                  pathname: "/subScreens/imageEdit",
                  params: { userId: profile.userId },
                })
              }
            >
              <AntDesign name="plus" size={s(13)} color="#fff" />
            </Pressable>
          </View>
          <Text style={st.name}>{profile.fullName || "Your Name"}</Text>
          {profile.InterestedSkills ? (
            <Text style={st.headline}>{profile.InterestedSkills}</Text>
          ) : null}
          {profile.location ? (
            <View style={st.locationRow}>
              <Ionicons name="location" size={s(14)} color="#6D4AFF" />
              <Text style={st.locationText}>{profile.location}</Text>
            </View>
          ) : null}
        </View>
        <View style={st.statsRow}>
          <Pressable
            style={st.statItem}
            onPress={() =>
              router.push({
                pathname: "/subScreens/friendsList",
                params: { userId: profile.userId, name: profile.fullName },
              })
            }
          >
            <View style={st.friend}>
              <Ionicons
                name="people"
                size={s(15)}
                color="#6D4AFF"
                style={st.friendIcon}
              />
              <Text style={st.statNumber}>{count}</Text>
              <Text style={st.statLabel}>Mindmates</Text>
            </View>
          </Pressable>
        </View>
        {skills.length > 0 && <ScrollablePills skills={skills} />}
        {skills.length > 0 && (
          <View style={st.skillsCard}>
            <View style={st.skillGrid}>
              {skills.map((skill, i) => (
                <SkillCard key={i} skill={skill} />
              ))}
            </View>
          </View>
        )}
        {profile.bio ? (
          <View style={{ paddingHorizontal: s(20) }}>
            <Text style={st.bioText} numberOfLines={2}>
              {profile.bio}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

ProfileScreen.whyDidYouRender = true;

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: s(25),
    paddingVertical: vs(10),
    backgroundColor: "#FFFFFF",
    textAlign: "center",
  },
  headerTitle: { fontSize: ms(18), fontWeight: "700", color: "#17191B" },
  scroll: { paddingBottom: vs(300), paddingTop: vs(8) },
  friend: { flexDirection: "row", alignItems: "center" },
  friendIcon: { marginRight: s(5), marginTop: vs(1) },
  avatarBlock: { alignItems: "center", paddingBottom: vs(8) },
  avatarWrap: { position: "relative", marginBottom: vs(3) },
  avatar: {
    width: s(105),
    height: s(105),
    borderRadius: s(55),
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    width: s(110),
    height: s(110),
    borderRadius: s(55),
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarPlaceholderText: {
    fontSize: ms(38),
    fontWeight: "700",
    color: "#6D4AFF",
  },
  addBadge: {
    position: "absolute",
    bottom: vs(6),
    right: s(5),
    width: s(22),
    height: s(22),
    borderRadius: s(15),
    backgroundColor: "#6D4AFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F4F4F8",
  },
  name: {
    fontSize: ms(15),
    fontWeight: "600",
    color: "#17191B",
    marginBottom: vs(2),
  },
  headline: {
    fontSize: ms(13),
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: vs(4),
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: s(4) },
  locationText: { fontSize: ms(12), color: "#6B7280", fontWeight: "500" },
  statsRow: {
    alignSelf: "flex-start",
    marginLeft: s(20),
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: s(16),
  },
  statItem: { alignItems: "center" },
  statNumber: {
    fontSize: ms(14),
    fontWeight: "700",
    color: "#6D4AFF",
    marginRight: s(3),
  },
  statLabel: { fontSize: ms(13), fontWeight: "500", color: "#6D4AFF" },
  pillsWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(14),
    paddingTop: vs(18),
    paddingBottom: vs(6),
  },

  pillsScroll: { flex: 1, marginHorizontal: s(6) },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(0),
    paddingHorizontal: s(0),
  },

  pill: {
    paddingHorizontal: s(14),
    paddingVertical: vs(8),
    borderRadius: s(20),
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: s(2),
    marginRight: s(4),
  },
  pillActive: { backgroundColor: "#6D4AFF", borderColor: "#6D4AFF" },
  pillText: { fontSize: ms(12), fontWeight: "600", color: "#374151" },
  pillTextActive: { color: "#fff" },

  skillsCard: {
    backgroundColor: "#fff",
    marginTop: vs(10),
    padding: s(5),
    marginHorizontal: s(30),
  },
  skillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: s(20),
  },
  skillCard: {
    alignItems: "center",
    width: "18%",
    minWidth: s(30),
    maxWidth: s(90),
  },
  skillIconWrap: {
    width: s(56),
    height: s(56),
    borderRadius: s(16),
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: vs(6),
  },
  skillName: {
    fontSize: ms(11),
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
    lineHeight: ms(15),
  },
  bioText: {
    fontSize: ms(14),
    color: "#6B7280",
    lineHeight: ms(20),
    marginTop: vs(15),
  },
  errorState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: vs(12),
  },
  errorText: { fontSize: ms(16), color: "#6B7280" },
  retryBtn: {
    backgroundColor: "#6D4AFF",
    paddingHorizontal: s(24),
    paddingVertical: vs(12),
    borderRadius: s(12),
  },
  retryText: { color: "#fff", fontWeight: "600" },
});
export default ProfileScreen;
