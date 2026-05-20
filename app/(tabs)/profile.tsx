import { useAuthh } from "@/Contexts/authContext";
import { useProfile } from "@/Contexts/profileContext";
import { useConnectionCount } from "@/hooks/useConnectionCount";
import { AntDesign } from "@expo/vector-icons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
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
const SKILL_ICONS: Record<string, string> = {
  "Art": "color-palette-outline",
  "Painting": "brush-outline",
  "Photography": "camera-outline",
  "Videography": "videocam-outline",
  "Acting": "theater-outline",
  "Singing": "mic-outline",
  "Freefire": "game-controller-outline",
  "BGMI": "game-controller-outline",
  "Freelancing": "laptop-outline",
  "Gym": "barbell-outline",
  "Yoga": "body-outline",
  "Running": "walk-outline",
  "Cycling": "bicycle-outline",
  "Swimming": "water-outline",
  "Boxing": "fitness-outline",
  "Bulking": "fitness-outline",
  "Weight Loss": "scale-outline",
  "PowerLifter": "barbell-outline",
  "Bodybuilding": "body-outline",
  "Programming": "code-slash-outline",
  "App Development": "phone-portrait-outline",
  "Web Development": "globe-outline",
  "AI / ML": "hardware-chip-outline",
  "Cybersecurity": "shield-checkmark-outline",
  "UI/UX Design": "color-wand-outline",
  "Python": "code-slash-outline",
  "Java": "code-slash-outline",
  "Govt Prep": "book-outline",
  "Business": "briefcase-outline",
  "Short Films": "film-outline",
  "Football": "football-outline",
  "Cricket": "baseball-outline",
  "Basketball": "basketball-outline",
  "Tennis": "tennisball-outline",
  "Kabaddi": "people-outline",
  "Athletics": "timer-outline",
  "Startups": "rocket-outline",
  "Content Creator": "create-outline",
  "Music": "musical-notes-outline",
  "Dancing": "walk-outline",
  "Writing": "pencil-outline",
  "Sketching": "brush-outline",
  "Cooking": "restaurant-outline",
  "Travel": "airplane-outline",
  "Fashion": "shirt-outline",
  "Podcast": "mic-circle-outline",
  "Gardening": "leaf-outline",
  "Pets & Animals": "paw-outline",
  "Chess": "grid-outline",
  "Badminton": "tennisball-outline",
  "Volleyball": "football-outline",
  "Table Tennis": "tennisball-outline",
  "Martial Arts": "fitness-outline",
  "Calisthenics": "body-outline",
  "Archery": "navigate-outline",
  "Data Science": "analytics-outline",
  "Cloud Computing": "cloud-outline",
  "Blockchain": "link-outline",
  "React Native": "phone-portrait-outline",
  "DevOps": "server-outline",
  "3D Printing": "cube-outline",
  "Graphic Design": "color-wand-outline",
  "Motion Design": "film-outline",
  "3D Modeling": "cube-outline",
  "Illustration": "brush-outline",
  "Brand Design": "ribbon-outline",
  "Marketing": "megaphone-outline",
  "Trading": "swap-horizontal-outline",
  "E-Commerce": "storefront-outline",
  "Filmmaking": "videocam-outline",
  "Music Production": "headset-outline",
  "Skincare": "sparkles-outline",
};
const DEFAULT_ICON = "flash-outline";

const SkeletonBox = ({ width, height, borderRadius = 8, style }: any) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: "#E5E7EB", opacity },
        style,
      ]}
    />
  );
};

const ProfileSkeleton = () => (
  <ScrollView
    contentContainerStyle={s.scroll}
    showsVerticalScrollIndicator={false}
  >
    <View style={{ alignItems: "center", paddingTop: 32 }}>
      <SkeletonBox
        width={110}
        height={110}
        borderRadius={55}
        style={{ marginBottom: 14 }}
      />
      <SkeletonBox width={160} height={22} style={{ marginBottom: 10 }} />
      <SkeletonBox width={120} height={16} style={{ marginBottom: 8 }} />
      <SkeletonBox width={100} height={14} style={{ marginBottom: 24 }} />
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          marginBottom: 24,
          paddingHorizontal: 20,
        }}
      >
        <SkeletonBox width={90} height={36} borderRadius={20} />
        <SkeletonBox width={90} height={36} borderRadius={20} />
        <SkeletonBox width={90} height={36} borderRadius={20} />
      </View>
    </View>
    <View style={{ paddingHorizontal: 20 }}>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
        <SkeletonBox width={90} height={100} borderRadius={14} />
        <SkeletonBox width={90} height={100} borderRadius={14} />
        <SkeletonBox width={90} height={100} borderRadius={14} />
      </View>
      <SkeletonBox width="100%" height={14} style={{ marginBottom: 8 }} />
      <SkeletonBox width="75%" height={14} />
    </View>
  </ScrollView>
);

const SkillPill = React.memo(
  ({ skill, active }: { skill: string; active?: boolean }) => (
    <View style={[s.pill, active && s.pillActive]}>
      <Ionicons
        name={(SKILL_ICONS[skill] ?? DEFAULT_ICON) as any}
        size={13}
        color={active ? "#fff" : "#6D4AFF"}
        style={{ marginRight: 5 }}
      />
      <Text style={[s.pillText, active && s.pillTextActive]}>{skill}</Text>
    </View>
  ),
);

const SkillCard = React.memo(({ skill }: { skill: string }) => (
  <View style={s.skillCard}>
    <View style={s.skillIconWrap}>
      <Ionicons
        name={(SKILL_ICONS[skill] ?? DEFAULT_ICON) as any}
        size={32}
        color="#6D4AFF"
      />
    </View>
    <Text style={s.skillName}>{skill}</Text>
  </View>
));

const ScrollablePills = ({ skills }: { skills: string[] }) => {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  return (
    <View style={s.pillsWrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled={true}
        onScroll={(e) => {
          scrollX.current = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={s.pillRow}
        style={s.pillsScroll}
      >
        {skills.map((skill, i) => (
          <SkillPill key={i} skill={skill} active={i === 0} />
        ))}
      </ScrollView>
    </View>
  );
};

const ProfileScreen = () => {
  const { profile, isLoading, reloadProfile } = useProfile();
  const { user } = useAuthh();
  const { count } = useConnectionCount(profile?.userId);
  useEffect(() => {
    if (!isLoading && !profile && user?.id) reloadProfile();
  }, [isLoading, profile, user?.id]);
  if (isLoading)
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={s.header}>
          <View style={{ width: 32 }} />
          <Text style={s.headerTitle}>Profile</Text>
          <View style={{ width: 32 }} />
        </View>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  if (!profile)
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <AntDesign name="arrow-left" size={20} color="#232529" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Profile</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={s.errorState}>
          <Text style={s.errorText}>Profile not found</Text>
          <TouchableOpacity style={s.retryBtn} onPress={reloadProfile}>
            <Text style={s.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  const imageUrl = toPublicImageUrl(profile.profileImage);
  const skills = profile.skillsArray ?? [];
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="chevron-back"
            size={20}
            color="#17191B"
            style={{ top: 3 }}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/subScreens/Settings")}>
          <Ionicons name="settings" size={17} color="#17191B" />
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        <View style={s.avatarBlock}>
          <View style={s.avatarWrap}>
            <Pressable onPress={() => router.push("/subScreens/imagePreview")}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={s.avatar} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Text style={s.avatarPlaceholderText}>
                    {profile.fullName?.charAt(0)?.toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={s.addBadge}
              onPress={() =>
                router.push({
                  pathname: "/subScreens/imageEdit",
                  params: { userId: profile.userId },
                })
              }
            >
              <AntDesign name="plus" size={14} color="#fff" />
            </Pressable>
          </View>
          <Text style={s.name}>{profile.fullName || "Your Name"}</Text>
          {profile.InterestedSkills ? (
            <Text style={s.headline}>{profile.InterestedSkills}</Text>
          ) : null}
          {profile.location ? (
            <View style={s.locationRow}>
              <Ionicons name="location" size={14} color="#6D4AFF" />
              <Text style={s.locationText}>{profile.location}</Text>
            </View>
          ) : null}
        </View>
        <View style={s.statsRow}>
          <Pressable
            style={s.statItem}
            onPress={() =>
              router.push({
                pathname: "/subScreens/friendsList",
                params: { userId: profile.userId, name: profile.fullName },
              })
            }
          >
            <View style={s.friend}>
              <Ionicons
                name="people"
                size={15}
                color="#6D4AFF"
                style={{ right: 7, marginLeft: 2 }}
              />
              <Text style={s.statNumber}>{count}</Text>
              <Text style={s.statLabel}>Mindmates</Text>
            </View>
          </Pressable>
        </View>
        {skills.length > 0 && <ScrollablePills skills={skills} />}
        {skills.length > 0 && (
          <View style={s.skillsCard}>
            <View style={s.skillGrid}>
              {skills.slice(0, 3).map((skill, i) => (
                <SkillCard key={i} skill={skill} />
              ))}
            </View>
            {profile.bio ? (
              <Text style={s.bioText} numberOfLines={2}>
                {profile.bio}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 25,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    top: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#17191B" },
  scroll: { paddingBottom: 40, paddingTop: 8 },
  friend: { flexDirection: "row", alignItems: "center", top: 2 },
  avatarBlock: { alignItems: "center", paddingBottom: 8 },
  avatarWrap: { position: "relative", marginBottom: 3 },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarPlaceholderText: { fontSize: 38, fontWeight: "700", color: "#6D4AFF" },
  addBadge: {
    position: "absolute",
    bottom: 4,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#6D4AFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F4F4F8",
  },
  name: { fontSize: 18, fontWeight: "700", color: "#17191B", marginBottom: 2 },
  headline: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 4,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, right: 7 },
  locationText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 2,
    borderRadius: 16,
    right: 110,
  },
  statItem: { alignItems: "center", flex: 1 },
  statNumber: { fontSize: 14, fontWeight: "700", color: "#6D4AFF", right: 3 },
  statLabel: { fontSize: 14, fontWeight: "500", color: "#6D4AFF" },
  pillsWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 6,
    width: "105%",
    right: 5,
  },
  pillsScroll: { flex: 1, marginHorizontal: 6 },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
  },
  pillActive: { backgroundColor: "#6D4AFF", borderColor: "#6D4AFF" },
  pillText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  pillTextActive: { color: "#fff" },
  skillsCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 18,
    left: 6,
  },
  skillGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  skillCard: { alignItems: "center", flex: 1 },
  skillIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  skillName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
    top: 2,
  },
  bioText: { fontSize: 14, color: "#6B7280", lineHeight: 20, top: 7 },
  errorState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  errorText: { fontSize: 16, color: "#6B7280" },
  retryBtn: {
    backgroundColor: "#6D4AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: "#fff", fontWeight: "600" },
});

export default ProfileScreen;
