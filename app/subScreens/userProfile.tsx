import { ProfileSkeleton } from "@/components/profile/profileSkeleton";
import { ScrollablePills, SkillCard } from "@/components/profile/skillDisplay";
import { useAuthh } from "@/Contexts/authContext";
import { useRenderCount } from "@/Count";
import {
  useConnection,
  useConnectionLoading,
  useConnectionStatus,
} from "@/hooks/useConnection";
import { useConnectionCount } from "@/hooks/useConnectionCount";
import { supabase, TABLES } from "@/lib/supabase";
import { ms, s, vs } from "@/utils/scale";
import { parseSkills } from "@/utils/skill";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
interface UserProfile {
  user_id: string;
  full_name: string;
  interested_skills: string | null;
  location: string | null;
  bio: string | null;
  profile_image: string | null;
  skills: string | null;
}
const ConnectBtn = ({
  targetUserId,
  fullName,
  profileImage,
  skills,
}: {
  targetUserId: string;
  fullName: string;
  profileImage: string | null;
  skills: string;
}) => {
  const status = useConnectionStatus(targetUserId);
  const loading = useConnectionLoading(targetUserId);
  const { sendRequest, cancelRequest } = useConnection();
  const cfg = {
    none: { label: "Connect", bg: "#6D4AFF", fg: "#fff", border: "#6D4AFF" },
    pending: {
      label: "Requested",
      bg: "#FFFFFF",
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
      bg: "#6D4AFF",
      fg: "#fff",
      border: "#6D4AFF",
    },
  }[status];
  const handlePress = () => {
    if (loading || status === "accepted") return;
    if (status === "none" || status === "rejected")
      sendRequest({ userId: targetUserId, fullName, profileImage, skills });
    else if (status === "pending") cancelRequest(targetUserId);
  };
  return (
    <TouchableOpacity
      style={[
        st.connectBtn,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
      ]}
      onPress={handlePress}
      disabled={loading || status === "accepted"}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color={cfg.fg} />
      ) : (
        <Text style={[st.connectBtnText, { color: cfg.fg }]}>{cfg.label}</Text>
      )}
    </TouchableOpacity>
  );
};

export default function UserProfileScreen() {
  useRenderCount("userprofile");
  const params = useLocalSearchParams<{ userId: string }>();
  const { user: me } = useAuthh();
  const { loadStatuses } = useConnection();
  const targetUserId = params.userId?.trim() ?? "";
  const { count } = useConnectionCount(targetUserId);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchProfile = useCallback(async () => {
    if (!targetUserId) {
      setError("No user ID provided");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: qErr } = await supabase
        .from(TABLES.users)
        .select(
          "user_id, full_name, interested_skills, location, bio, profile_image, skills",
        )
        .eq("user_id", targetUserId)
        .single();

      if (qErr || !data) {
        if (qErr?.code === "PGRST116") {
          setError("User not found");
        } else {
          const isNet =
            qErr?.message?.includes("Network request failed") ||
            qErr?.name === "TypeError";
          setError(
            isNet
              ? "Network error. Please check your connection."
              : "Could not load profile",
          );
        }
        return;
      }
      setProfile(data as UserProfile);
      loadStatuses([targetUserId]);
    } catch (err: any) {
      const isNet =
        err?.message?.includes("Network request failed") ||
        err?.name === "TypeError";
      setError(
        isNet
          ? "Network error. Please check your connection."
          : "Could not load profile",
      );
    } finally {
      setLoading(false);
    }
  }, [targetUserId, loadStatuses]);
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);
  const isOwnProfile = me?.id === targetUserId;
  const HeaderBar = () => (
    <View style={st.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <Ionicons
          name="chevron-back"
          size={s(17)}
          color="#17191B"
          style={{ marginTop: 8 }}
        />
      </TouchableOpacity>
      <View style={{ width: s(32) }} />
    </View>
  );
  if (loading)
    return (
      <SafeAreaView style={st.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={st.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={s(16)} color="#17191B" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>Profile</Text>
          <View style={{ width: s(32) }} />
        </View>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  if (error || !profile)
    return (
      <SafeAreaView style={st.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={st.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={s(16)} color="#17191B" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>Profile</Text>
          <View style={{ width: s(32) }} />
        </View>
        <View style={st.errorState}>
          <Text style={st.errorText}>{error ?? "Profile not found"}</Text>
          <TouchableOpacity style={st.retryBtn} onPress={fetchProfile}>
            <Text style={st.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  const imageUrl = profile.profile_image?.trim() || null;
  const skills = parseSkills(profile.skills);
  return (
    <SafeAreaView style={st.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <HeaderBar />
      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={st.avatarBlock}>
          <View style={st.avatarWrap}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/subScreens/imagePreview",
                  params: {
                    userId: targetUserId,
                    image: imageUrl || "",
                    name: profile.full_name,
                  },
                })
              }
            >
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
                    {profile.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
          <Text style={st.name}>{profile.full_name || "User"}</Text>
          {profile.interested_skills ? (
            <Text style={st.headline}>{profile.interested_skills}</Text>
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
                params: { userId: targetUserId, name: profile.full_name },
              })
            }
          >
            <View style={st.friend}>
              <Ionicons
                name="people"
                size={s(15)}
                color="#6D4AFF"
                style={{ marginRight: s(4) }}
              />
              <Text style={st.statNumber}>{count}</Text>
              <Text style={st.statLabel}> Mindmates</Text>
            </View>
          </Pressable>
        </View>
        {!isOwnProfile ? (
          <View style={st.actionsRow}>
            <ConnectBtn
              targetUserId={targetUserId}
              fullName={profile.full_name}
              profileImage={profile.profile_image}
              skills={profile.skills ?? ""}
            />
            <TouchableOpacity
              style={st.messageBtn}
              onPress={() =>
                router.push({
                  pathname: "/subScreens/chatScreen",
                  params: {
                    userId: targetUserId,
                    name: profile.full_name,
                    image: profile.profile_image ?? "",
                    chatId: "",
                  },
                })
              }
              activeOpacity={0.85}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={s(17)}
                color="#6D4AFF"
              />
              <Text style={st.messageBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={st.editBtn}
            onPress={() => router.push("/subScreens/editProfile")}
          >
            <Ionicons name="create-outline" size={s(17)} color="#6D4AFF" />
            <Text style={st.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
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
        {profile.bio && profile.bio.length > 80 && (
          <View style={st.bioSection}>
            <Text style={st.bioSectionTitle}>About</Text>
            <Text style={st.bioSectionText}>{profile.bio}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

UserProfileScreen.whyDidYouRender = true;

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: s(25),
    paddingVertical: vs(4),
    backgroundColor: "#FFFFFF",
  },
  headerTitle: { fontSize: ms(18), fontWeight: "700", color: "#17191B" },
  scroll: { paddingBottom: vs(60), paddingTop: vs(8) },
  friend: { flexDirection: "row", alignItems: "center" },
  avatarBlock: { alignItems: "center", paddingBottom: vs(8) },
  avatarWrap: { position: "relative", marginBottom: vs(3) },
  avatar: {
    width: s(95),
    height: s(95),
    borderRadius: s(50),
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    width: s(95),
    height: s(95),
    borderRadius: s(50),
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

  name: {
    fontSize: ms(15),
    fontWeight: "500",
    color: "#17191B",
    marginBottom: vs(2),
  },
  headline: {
    fontSize: ms(13),
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: vs(4),
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: s(4),
  },
  locationText: { fontSize: ms(12), color: "#6B7280", fontWeight: "500" },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    marginHorizontal: s(25),
    borderRadius: s(16),
  },
  statItem: { alignItems: "center", flex: 1 },
  statNumber: {
    fontSize: ms(14),
    fontWeight: "700",
    color: "#6D4AFF",
  },
  statLabel: { fontSize: ms(14), fontWeight: "500", color: "#6D4AFF" },
  actionsRow: {
    flexDirection: "row",
    gap: s(25),
    marginHorizontal: s(35),
    marginTop: vs(8),
  },
  connectBtn: {
    flex: 1,
    paddingVertical: vs(11),
    borderRadius: s(12),
    alignItems: "center",
    borderWidth: 1.5,
  },
  connectBtnText: { fontSize: ms(14), fontWeight: "600" },
  messageBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(6),
    paddingVertical: vs(11),
    borderRadius: s(12),
    borderWidth: 1.5,
    borderColor: "#6D4AFF",
    backgroundColor: "#EDE9FE",
  },
  messageBtnText: { fontSize: ms(14), fontWeight: "700", color: "#6D4AFF" },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s(8),
    marginHorizontal: s(20),
    marginTop: vs(16),
    paddingVertical: vs(13),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  editBtnText: { fontSize: ms(15), fontWeight: "600", color: "#6D4AFF" },
  pillsWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: vs(14),
    paddingBottom: vs(4),
  },
  pillsScroll: { flex: 1 },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    paddingHorizontal: s(8),
  },
  pill: {
    paddingHorizontal: s(14),
    paddingVertical: vs(6),
    borderRadius: s(20),
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    marginRight: s(4),
  },
  pillActive: { backgroundColor: "#6D4AFF", borderColor: "#6D4AFF" },
  pillText: { fontSize: ms(13), fontWeight: "600", color: "#374151" },
  pillTextActive: { color: "#fff" },
  skillsCard: {
    backgroundColor: "#fff",
    marginTop: vs(10),
    padding: s(5),
    marginHorizontal: s(30),
    alignItems: "center",
  },
  skillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: s(20),
  },
  skillCard: {
    alignItems: "center",
    flex: 0,
    minWidth: s(70),
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
  bioSection: {
    backgroundColor: "#fff",
    marginHorizontal: s(20),
    borderRadius: s(20),
    padding: s(18),
    marginTop: vs(5),
  },
  bioSectionTitle: {
    fontSize: ms(15),
    fontWeight: "700",
    color: "#17191B",
    marginBottom: vs(8),
  },
  bioSectionText: {
    fontSize: ms(14),
    color: "#374151",
    lineHeight: ms(22),
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
