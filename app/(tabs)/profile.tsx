/**
 * ProfileScreen — Fully Responsive Refactor
 * ─────────────────────────────────────────────────────────────────────────────
 * Tested mental model: Android phones (360–412 dp), iPhones (375–430 pt),
 * Samsung/Oppo/Vivo/Xiaomi foldables, Pixel, and iPad / Android tablets.
 *
 * Every change is annotated with a numbered CHANGE comment so you can
 * diff against the original easily.
 */

import { useAuthh }            from "@/Contexts/authContext";
import { useProfile }          from "@/Contexts/profileContext";
import { useConnectionCount }  from "@/hooks/useConnectionCount";
import { AntDesign }           from "@expo/vector-icons";
import Ionicons                from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated, Image, Pressable, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { s, vs, ms } from "@/utils/scale";

// ─── helpers ─────────────────────────────────────────────────────────────────
const toPublicImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.includes("/preview")) {
    const base    = url.split("/preview")[0];
    const project = url.split("project=")[1]?.split("&")[0];
    return `${base}/view?project=${project}`;
  }
  return url;
};

const SKILL_ICONS: Record<string, string> = {
  "Art": "color-palette-outline", "Painting": "brush-outline", "Photography": "camera-outline",
  "Videography": "videocam-outline", "Acting": "theater-outline", "Singing": "mic-outline",
  "Freefire": "game-controller-outline", "BGMI": "game-controller-outline", "Freelancing": "laptop-outline",
  "Gym": "barbell-outline", "Yoga": "body-outline", "Running": "walk-outline", "Cycling": "bicycle-outline",
  "Swimming": "water-outline", "Boxing": "fitness-outline", "Bulking": "fitness-outline",
  "Weight Loss": "scale-outline", "PowerLifter": "barbell-outline", "Bodybuilding": "body-outline",
  "Programming": "code-slash-outline", "App Development": "phone-portrait-outline",
  "Web Development": "globe-outline", "AI / ML": "hardware-chip-outline",
  "Cybersecurity": "shield-checkmark-outline", "UI/UX Design": "color-wand-outline",
  "Python": "code-slash-outline", "Java": "code-slash-outline", "Govt Prep": "book-outline",
  "Business": "briefcase-outline", "Short Films": "film-outline", "Football": "football-outline",
  "Cricket": "baseball-outline", "Basketball": "basketball-outline", "Tennis": "tennisball-outline",
  "Kabaddi": "people-outline", "Athletics": "timer-outline", "Startups": "rocket-outline",
  "Content Creator": "create-outline", "Music": "musical-notes-outline", "Dancing": "walk-outline",
  "Writing": "pencil-outline", "Sketching": "brush-outline", "Cooking": "restaurant-outline",
  "Travel": "airplane-outline", "Fashion": "shirt-outline", "Podcast": "mic-circle-outline",
  "Gardening": "leaf-outline", "Pets & Animals": "paw-outline", "Chess": "grid-outline",
  "Badminton": "tennisball-outline", "Volleyball": "football-outline", "Table Tennis": "tennisball-outline",
  "Martial Arts": "fitness-outline", "Calisthenics": "body-outline", "Archery": "navigate-outline",
  "Data Science": "analytics-outline", "Cloud Computing": "cloud-outline", "Blockchain": "link-outline",
  "React Native": "phone-portrait-outline", "DevOps": "server-outline", "3D Printing": "cube-outline",
  "Graphic Design": "color-wand-outline", "Motion Design": "film-outline", "3D Modeling": "cube-outline",
  "Illustration": "brush-outline", "Brand Design": "ribbon-outline", "Marketing": "megaphone-outline",
  "Trading": "swap-horizontal-outline", "E-Commerce": "storefront-outline", "Filmmaking": "videocam-outline",
  "Music Production": "headset-outline", "Skincare": "sparkles-outline",
};
const DEFAULT_ICON = "flash-outline";

// ─── SkeletonBox ──────────────────────────────────────────────────────────────
const SkeletonBox = ({ width, height, borderRadius = s(8), style }: any) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1,   duration: 800, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: "#E5E7EB", opacity }, style]}
    />
  );
};

// ─── ProfileSkeleton ──────────────────────────────────────────────────────────
const ProfileSkeleton = () => (
  <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
    <View style={{ alignItems: "center", paddingTop: vs(32) }}>
      <SkeletonBox width={s(110)} height={s(110)} borderRadius={s(55)} style={{ marginBottom: vs(14) }} />
      <SkeletonBox width={s(160)} height={vs(22)} style={{ marginBottom: vs(10) }} />
      <SkeletonBox width={s(120)} height={vs(16)} style={{ marginBottom: vs(8) }} />
      <SkeletonBox width={s(100)} height={vs(14)} style={{ marginBottom: vs(24) }} />
      <View style={{ flexDirection: "row", gap: s(10), marginBottom: vs(24), paddingHorizontal: s(20) }}>
        <SkeletonBox width={s(90)} height={vs(36)} borderRadius={s(20)} />
        <SkeletonBox width={s(90)} height={vs(36)} borderRadius={s(20)} />
        <SkeletonBox width={s(90)} height={vs(36)} borderRadius={s(20)} />
      </View>
    </View>
    <View style={{ paddingHorizontal: s(20) }}>
      <View style={{ flexDirection: "row", gap: s(10), marginBottom: vs(24) }}>
        <SkeletonBox width={s(90)} height={vs(100)} borderRadius={s(14)} />
        <SkeletonBox width={s(90)} height={vs(100)} borderRadius={s(14)} />
        <SkeletonBox width={s(90)} height={vs(100)} borderRadius={s(14)} />
      </View>
      <SkeletonBox width="100%" height={vs(14)} style={{ marginBottom: vs(8) }} />
      <SkeletonBox width="75%"  height={vs(14)} />
    </View>
  </ScrollView>
);

// ─── SkillPill ────────────────────────────────────────────────────────────────
const SkillPill = React.memo(({ skill, active }: { skill: string; active?: boolean }) => (
  <View style={[st.pill, active && st.pillActive]}>
    <Ionicons
      name={(SKILL_ICONS[skill] ?? DEFAULT_ICON) as any}
      size={s(13)}
      color={active ? "#fff" : "#6D4AFF"}
      style={{ marginRight: s(5) }}
    />
    <Text style={[st.pillText, active && st.pillTextActive]}>{skill}</Text>
  </View>
));

// ─── SkillCard ────────────────────────────────────────────────────────────────
const SkillCard = React.memo(({ skill }: { skill: string }) => (
  <View style={st.skillCard}>
    <View style={st.skillIconWrap}>
      <Ionicons name={(SKILL_ICONS[skill] ?? DEFAULT_ICON) as any} size={s(28)} color="#6D4AFF" />
    </View>
    <Text style={st.skillName} numberOfLines={2}>{skill}</Text>
  </View>
));

// ─── ScrollablePills ──────────────────────────────────────────────────────────
const ScrollablePills = ({ skills }: { skills: string[] }) => {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX   = useRef(0);
  return (
    // CHANGE 1: Removed width:"110%" and right:s(15). These caused the pills
    // container to overflow its parent on every screen width. A horizontal
    // ScrollView inside a full-width View is self-contained; no negative offset
    // is needed. paddingHorizontal on the outer View gives the same visual
    // breathing room without breaking layout on tablets or small phones.
    <View style={st.pillsWrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        onScroll={(e) => { scrollX.current = e.nativeEvent.contentOffset.x; }}
        scrollEventThrottle={16}
        contentContainerStyle={st.pillRow}
        style={st.pillsScroll}
      >
        {skills.map((skill, i) => <SkillPill key={i} skill={skill} active={i === 0} />)}
      </ScrollView>
    </View>
  );
};

// ─── ProfileScreen ────────────────────────────────────────────────────────────
const ProfileScreen = () => {
  const { profile, isLoading, reloadProfile, error } = useProfile();
  const { user }  = useAuthh();
  const { count, refetch: reloadCount } = useConnectionCount(profile?.userId);

  useEffect(() => {
    if (!isLoading && !profile && user?.id) reloadProfile();
  }, [isLoading, profile, user?.id]);

  useFocusEffect(
    useCallback(() => { reloadCount(); }, [profile?.userId])
  );

  if (isLoading) return (
    <SafeAreaView style={st.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <View style={st.header}>
        <View style={{ width: s(32) }} />
        <Text style={st.headerTitle}>Profile</Text>
        <View style={{ width: s(32) }} />
      </View>
      <ProfileSkeleton />
    </SafeAreaView>
  );

  if (!profile) return (
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
  const skills   = profile.skillsArray ?? [];

  return (
    <SafeAreaView style={st.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* CHANGE 2: Removed top:vs(10) from header. SafeAreaView edges={["top"]}
          already handles notch/status-bar insets on every device. An extra
          positive `top` offset pushes the header down into content space,
          causing double-gap on iPhones and wrong alignment on Android. Use
          paddingVertical only — the original vs(10) is preserved there. */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={s(18)} color="#17191B" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/subScreens/Settings")}>
          <Ionicons name="settings" size={s(16)} color="#17191B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Avatar block — unchanged */}
        <View style={st.avatarBlock}>
          <View style={st.avatarWrap}>
            <Pressable onPress={() => router.push("/subScreens/imagePreview")}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={st.avatar} />
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
              onPress={() => router.push({ pathname: "/subScreens/imageEdit", params: { userId: profile.userId } })}
            >
              <AntDesign name="plus" size={s(14)} color="#fff" />
            </Pressable>
          </View>
          <Text style={st.name}>{profile.fullName || "Your Name"}</Text>
          {profile.InterestedSkills ? <Text style={st.headline}>{profile.InterestedSkills}</Text> : null}
          {profile.location ? (
            // CHANGE 3: Removed right:s(7) from locationRow. Absolute directional
            // offsets on a centred flex-row shift the visual centre differently
            // on every screen width. The row is already centred by the parent
            // `alignItems:"center"` on avatarBlock — no nudge is required.
            <View style={st.locationRow}>
              <Ionicons name="location" size={s(14)} color="#6D4AFF" />
              <Text style={st.locationText}>{profile.location}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats row
            CHANGE 4: Removed right:s(110) and replaced the fixed-offset trick
            with alignSelf:"flex-start" + marginLeft:s(20). The original used
            a large `right` to visually left-align the stat within the full-
            width row, but that offset is a hardcoded pixel value that only
            works on one reference screen width. On tablets it leaves a huge
            gap; on small phones it can push content off-screen.
            `alignSelf:"flex-start"` + horizontal margin achieves the same
            left-aligned look and scales correctly on every device. */}
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
              <Ionicons name="people" size={s(15)} color="#6D4AFF" style={st.friendIcon} />
              <Text style={st.statNumber}>{count}</Text>
              <Text style={st.statLabel}>Mindmates</Text>
            </View>
          </Pressable>
        </View>

        {skills.length > 0 && <ScrollablePills skills={skills} />}
        {skills.length > 0 && (
          <View style={st.skillsCard}>
            <View style={st.skillGrid}>
              {skills.map((skill, i) => <SkillCard key={i} skill={skill} />)}
            </View>
          </View>
        )}
        {profile.bio ? (
          // CHANGE 5: Removed left:s(2) from bioText. A 2-unit nudge on a
          // full-width padded container has no visual purpose but can cause
          // sub-pixel misalignment on high-density displays. Padding on the
          // wrapper (paddingHorizontal:s(20)) already provides correct inset.
          <View style={{ paddingHorizontal: s(20) }}>
            <Text style={st.bioText} numberOfLines={2}>{profile.bio}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: s(25),
    paddingVertical:   vs(10),
    backgroundColor:   "#FFFFFF",
    // CHANGE 2 (style): `top` removed — see inline comment above.
  },

  headerTitle: { fontSize: ms(18), fontWeight: "700", color: "#17191B" },
  scroll:      { paddingBottom: vs(300), paddingTop: vs(8) },

  // CHANGE 4 (style): `top:vs(2)` moved to friendIcon; row itself is layout-only.
  friend: { flexDirection: "row", alignItems: "center" },

  // Isolated the icon nudge so the row container stays clean.
  friendIcon: { marginRight: s(5), marginTop: vs(1) },

  avatarBlock: { alignItems: "center", paddingBottom: vs(8) },
  avatarWrap:  { position: "relative", marginBottom: vs(3) },
  avatar: {
    width: s(105), height: s(105), borderRadius: s(55),
    borderWidth: 3, borderColor: "#fff",
  },
  avatarPlaceholder: {
    width: s(110), height: s(110), borderRadius: s(55),
    backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#fff",
  },
  avatarPlaceholderText: { fontSize: ms(38), fontWeight: "700", color: "#6D4AFF" },
  addBadge: {
    position:        "absolute",
    bottom:          vs(6),
    right:           s(5),
    width:           s(24),
    height:          s(24),
    borderRadius:    s(12),
    backgroundColor: "#6D4AFF",
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     2,
    borderColor:     "#F4F4F8",
    // NOTE: `position:"absolute"` here is intentional and correct — the badge
    // is pinned relative to its `position:"relative"` parent (avatarWrap), not
    // the screen. This is safe on all devices.
  },

  name:        { fontSize: ms(15), fontWeight: "600", color: "#17191B", marginBottom: vs(2) },
  headline:    { fontSize: ms(13), fontWeight: "500", color: "#6B7280", marginBottom: vs(4) },
  locationRow: { flexDirection: "row", alignItems: "center", gap: s(4) }, // CHANGE 3
  locationText: { fontSize: ms(12), color: "#6B7280", fontWeight: "500" },

  statsRow: {
    // CHANGE 4: replaced `right:s(110)` with `alignSelf + marginLeft`.
    // The row is now self-sizing around its content and anchored to the left
    // edge with a consistent margin — identical visual result, scales on all widths.
    alignSelf:   "flex-start",
    marginLeft:  s(20),
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius:    s(16),
  },

  statItem:   { alignItems: "center" },
  statNumber: { fontSize: ms(14), fontWeight: "700", color: "#6D4AFF", marginRight: s(3) },
  statLabel:  { fontSize: ms(13), fontWeight: "500", color: "#6D4AFF" },

  // CHANGE 1 (style): Removed `width:"110%"` and `right:s(15)`.
  // The pills row is now full-width (default 100%) with symmetric horizontal
  // padding. The horizontal ScrollView handles overflow internally.
  pillsWrapper: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: s(14),
    paddingTop:        vs(18),
    paddingBottom:     vs(6),
  },

  pillsScroll: { flex: 1, marginHorizontal: s(6) },
  pillRow:     { flexDirection: "row", alignItems: "center", gap: s(8), paddingHorizontal: s(2) },

  pill: {
    paddingHorizontal: s(14),
    paddingVertical:   vs(8),
    borderRadius:      s(20),
    borderWidth:       1.5,
    borderColor:       "#D1D5DB",
    backgroundColor:   "#fff",
    flexDirection:     "row",
    alignItems:        "center",
  },
  pillActive:     { backgroundColor: "#6D4AFF", borderColor: "#6D4AFF" },
  pillText:       { fontSize: ms(12), fontWeight: "600", color: "#374151" },
  pillTextActive: { color: "#fff" },

  skillsCard: {
    backgroundColor:  "#fff",
    marginTop:        vs(10),
    padding:          s(5),
    marginHorizontal: s(30),
  },
  skillGrid: {
    flexDirection:  "row",
    flexWrap:       "wrap",
    justifyContent: "flex-start",
    gap:            s(20),
  },
  skillCard: {
    alignItems: "center",
    width:      "18%",
    minWidth:   s(30),
    maxWidth:   s(90),
  },
  skillIconWrap: {
    width:           s(56),
    height:          s(56),
    borderRadius:    s(16),
    backgroundColor: "#EDE9FE",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    vs(6),
  },
  skillName: {
    fontSize:   ms(11),
    fontWeight: "600",
    color:      "#1F2937",
    textAlign:  "center",
    lineHeight: ms(15),
  },

  // CHANGE 5 (style): `left:s(2)` removed from bioText — see inline comment.
  bioText: { fontSize: ms(14), color: "#6B7280", lineHeight: ms(20), marginTop: vs(15) },

  errorState: { flex: 1, justifyContent: "center", alignItems: "center", gap: vs(12) },
  errorText:  { fontSize: ms(16), color: "#6B7280" },
  retryBtn: {
    backgroundColor:   "#6D4AFF",
    paddingHorizontal: s(24),
    paddingVertical:   vs(12),
    borderRadius:      s(12),
  },
  retryText: { color: "#fff", fontWeight: "600" },
});

export default ProfileScreen;