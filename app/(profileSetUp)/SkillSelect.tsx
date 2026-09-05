import { useAuthh } from "@/Contexts/authContext";
import { useProfile } from "@/Contexts/profileContext";
import { useRenderCount } from "@/Count";
import { supabase, TABLES } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { TYPOGRAPHY } from "@/theme/typography";
import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  ListRenderItem,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { setProfileCompleting } from "../_layout";
type Category = "Passion" | "Design" | "Tech" | "Sports" | "Business" | "Fun";
interface Skill {
  id: number;
  name: string;
  category: Category;
  icon: string;
}
const CATEGORIES: Category[] = [
  "Passion",
  "Design",
  "Tech",
  "Sports",
  "Business",
  "Fun",
];
const SKILLS: Skill[] = [
  { id: 1, name: "Art", category: "Passion", icon: "color-palette-outline" },
  { id: 2, name: "Painting", category: "Passion", icon: "brush-outline" },
  { id: 3, name: "Photography", category: "Passion", icon: "camera-outline" },
  { id: 4, name: "Videography", category: "Passion", icon: "videocam-outline" },
  { id: 5, name: "Acting", category: "Passion", icon: "theater-outline" },
  { id: 6, name: "Singing", category: "Passion", icon: "mic-outline" },
  { id: 7, name: "Freefire", category: "Fun", icon: "game-controller-outline" },
  { id: 8, name: "BGMI", category: "Fun", icon: "game-controller-outline" },
  { id: 9, name: "Freelancing", category: "Business", icon: "laptop-outline" },
  { id: 10, name: "Gym", category: "Sports", icon: "barbell-outline" },
  { id: 11, name: "Yoga", category: "Sports", icon: "body-outline" },
  { id: 12, name: "Running", category: "Sports", icon: "walk-outline" },
  { id: 13, name: "Cycling", category: "Sports", icon: "bicycle-outline" },
  { id: 14, name: "Swimming", category: "Sports", icon: "water-outline" },
  { id: 15, name: "Boxing", category: "Sports", icon: "fitness-outline" },
  { id: 18, name: "PowerLifter", category: "Sports", icon: "barbell-outline" },
  { id: 19, name: "Bodybuilding", category: "Sports", icon: "body-outline" },
  { id: 20, name: "Programming", category: "Tech", icon: "code-slash-outline" },
  {
    id: 21,
    name: "App Development",
    category: "Tech",
    icon: "phone-portrait-outline",
  },
  { id: 22, name: "Web Development", category: "Tech", icon: "globe-outline" },
  { id: 23, name: "AI / ML", category: "Tech", icon: "hardware-chip-outline" },
  {
    id: 24,
    name: "Cybersecurity",
    category: "Tech",
    icon: "shield-checkmark-outline",
  },
  {
    id: 25,
    name: "UI/UX Design",
    category: "Design",
    icon: "color-wand-outline",
  },
  { id: 26, name: "Python", category: "Tech", icon: "code-slash-outline" },
  { id: 27, name: "Java", category: "Tech", icon: "code-slash-outline" },
  { id: 28, name: "Govt Prep", category: "Passion", icon: "book-outline" },
  { id: 29, name: "Business", category: "Business", icon: "briefcase-outline" },
  { id: 30, name: "Short Films", category: "Passion", icon: "film-outline" },
  { id: 31, name: "Football", category: "Sports", icon: "football-outline" },
  { id: 32, name: "Cricket", category: "Sports", icon: "baseball-outline" },
  {
    id: 33,
    name: "Basketball",
    category: "Sports",
    icon: "basketball-outline",
  },
  { id: 34, name: "Tennis", category: "Sports", icon: "tennisball-outline" },
  { id: 35, name: "Kabaddi", category: "Sports", icon: "people-outline" },
  { id: 36, name: "Athletics", category: "Sports", icon: "timer-outline" },
  { id: 37, name: "Startups", category: "Business", icon: "rocket-outline" },
  {
    id: 38,
    name: "Content Creator",
    category: "Passion",
    icon: "create-outline",
  },
  { id: 39, name: "Music", category: "Passion", icon: "musical-notes-outline" },
  { id: 40, name: "Dancing", category: "Passion", icon: "walk-outline" },
  { id: 41, name: "Writing", category: "Passion", icon: "pencil-outline" },
  { id: 43, name: "Sketching", category: "Passion", icon: "brush-outline" },
  { id: 44, name: "Cooking", category: "Passion", icon: "restaurant-outline" },
  { id: 46, name: "Travel", category: "Passion", icon: "airplane-outline" },
  { id: 52, name: "Fashion", category: "Passion", icon: "shirt-outline" },
  { id: 55, name: "Podcast", category: "Passion", icon: "mic-circle-outline" },
  { id: 59, name: "Gardening", category: "Passion", icon: "leaf-outline" },
  { id: 60, name: "Pets & Animals", category: "Passion", icon: "paw-outline" },
  { id: 64, name: "Chess", category: "Fun", icon: "grid-outline" },
  { id: 74, name: "Badminton", category: "Sports", icon: "tennisball-outline" },
  { id: 75, name: "Volleyball", category: "Sports", icon: "football-outline" },
  {
    id: 76,
    name: "Table Tennis",
    category: "Sports",
    icon: "tennisball-outline",
  },
  { id: 78, name: "Martial Arts", category: "Sports", icon: "fitness-outline" },
  { id: 79, name: "Calisthenics", category: "Sports", icon: "body-outline" },
  { id: 83, name: "Archery", category: "Sports", icon: "navigate-outline" },
  { id: 85, name: "Data Science", category: "Tech", icon: "analytics-outline" },
  { id: 86, name: "Cloud Computing", category: "Tech", icon: "cloud-outline" },
  { id: 87, name: "Blockchain", category: "Tech", icon: "link-outline" },
  { id: 91, name: "DevOps", category: "Tech", icon: "server-outline" },
  { id: 93, name: "3D Printing", category: "Tech", icon: "cube-outline" },
  {
    id: 95,
    name: "Graphic Design",
    category: "Design",
    icon: "color-wand-outline",
  },
  { id: 96, name: "Motion Design", category: "Design", icon: "film-outline" },
  { id: 97, name: "3D Modeling", category: "Design", icon: "cube-outline" },
  { id: 98, name: "Illustration", category: "Design", icon: "brush-outline" },
  { id: 99, name: "Brand Design", category: "Design", icon: "ribbon-outline" },
  {
    id: 103,
    name: "Marketing",
    category: "Business",
    icon: "megaphone-outline",
  },
  {
    id: 106,
    name: "Trading",
    category: "Business",
    icon: "swap-horizontal-outline",
  },
  {
    id: 107,
    name: "E-Commerce",
    category: "Business",
    icon: "storefront-outline",
  },
  {
    id: 123,
    name: "Filmmaking",
    category: "Passion",
    icon: "videocam-outline",
  },
  {
    id: 124,
    name: "Music Production",
    category: "Passion",
    icon: "headset-outline",
  },
  { id: 128, name: "Skincare", category: "Passion", icon: "sparkles-outline" },
];
const SkillCard = React.memo(
  ({
    skill,
    isSelected,
    onToggle,
    cardSize,
  }: {
    skill: Skill;
    isSelected: boolean;
    onToggle: (id: number) => void;
    cardSize: number;
  }) => {
    const scale = React.useRef(new Animated.Value(1)).current;
    const handlePress = useCallback(() => {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.93,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 15,
          useNativeDriver: true,
        }),
      ]).start();
      onToggle(skill.id);
    }, [skill.id, onToggle, scale]);

    const content = (
      <>
        {isSelected ? (
          <LinearGradient
            colors={["#6D4AFF", "#6D4AFF"]}
            style={st.checkCircle}
          >
            <Ionicons name="checkmark" size={s(13)} color="#fff" />
          </LinearGradient>
        ) : (
          <View style={[st.checkCircle, st.checkUnch]} />
        )}
        <View style={st.iconWrap}>
          <Ionicons
            name={skill.icon as any}
            size={s(36)}
            color={isSelected ? "#6D4AFF" : "#374151"}
          />
        </View>
        <Text style={st.skillName}>{skill.name}</Text>
      </>
    );

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={{ width: cardSize }}
      >
        <Animated.View style={{ transform: [{ scale }], opacity: 1 }}>
          {isSelected ? (
            <LinearGradient
              colors={["#6D4AFF", "#6543ee"]}
              style={st.gradBorder}
            >
              <View style={st.cardInner}>{content}</View>
            </LinearGradient>
          ) : (
            <View style={[st.card, st.cardUnsel]}>{content}</View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  },
);
export default function SkillSelection() {
  useRenderCount("Skillselection");
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const CARD_SIZE = (width - s(52)) / 2;

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<Category>("Passion");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const { user } = useAuthh();
  const { profile, reloadProfile } = useProfile();

  const toggleSkill = useCallback((id: number) => {
    setSelectedIds((prev: Set<number>) => {
      const next = new Set<number>(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filtered = SKILLS.filter((sk) =>
    searchQuery.trim()
      ? sk.name.toLowerCase().includes(searchQuery.toLowerCase())
      : sk.category === activeCategory,
  );

  // const handleContinue = useCallback(async () => {
  //   if (!user?.id || saving) return;

  //   const names = Array.from(selectedIds)
  //     .map((id) => SKILLS.find((s) => s.id === id)?.name ?? "")
  //     .filter(Boolean);

  //   if (!names.length) return;

  //   setSaving(true);
  //   await new Promise<void>((resolve) =>
  //     requestAnimationFrame(() => resolve()),
  //   );

  //   try {
  //     const { error } = await supabase
  //       .from(TABLES.users)
  //       .update({
  //         skills: names.join(","),
  //         is_profile_complete: true,
  //         profile_image: profile?.profileImage ?? null,
  //       })
  //       .eq("user_id", user.id);

  //     if (error) {
  //       console.warn("[SkillSelection] DB write failed:", error.message);
  //       Toast.show({
  //         type: "error",
  //         text1: "Something went wrong. Please try again.",
  //       }); // see next finding
  //       setSaving(false);
  //       return;
  //     }
  //     updateProfile({
  //       skills:            names.join(','),
  //       skillsArray:       names,
  //       isProfileComplete: true,
  //     });
  //     setProfileCompleting(true);
  //     useAuthStore.getState().markProfileComplete();
  //       router.dismissAll();
  //       router.replace("/home");
  //     setTimeout(() => setProfileCompleting(false), 500);

  //   } catch (e: any) {
  //     console.warn("[SkillSelection] unexpected error:", e?.message);
  //     setSaving(false);
  //   }
  // }, [user?.id, saving, selectedIds, profile?.profileImage, updateProfile]);

  const handleContinue = useCallback(async () => {
    if (!user?.id || saving) return;

    const names = Array.from(selectedIds)
      .map((id) => SKILLS.find((s) => s.id === id)?.name ?? "")
      .filter(Boolean);

    if (!names.length) return;

    setSaving(true);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );

    try {
      const { error } = await supabase
        .from(TABLES.users)
        .update({
          skills: names.join(","),
          is_profile_complete: true,
          profile_image: profile?.profileImage ?? null,
        })
        .eq("user_id", user.id);

      if (error) {
        console.warn("[SkillSelection] DB write failed:", error.message);
        Toast.show({
          type: "error",
          text1: "Something went wrong. Please try again.",
        });
        setSaving(false);
        return;
      }

      await reloadProfile(); // sync local state from the write we just confirmed — no second write
      setProfileCompleting(true);
      useAuthStore.getState().markProfileComplete();
      router.dismissAll();
      router.replace("/home");
      setTimeout(() => setProfileCompleting(false), 500);
    } catch (e: any) {
      console.warn("[SkillSelection] unexpected error:", e?.message);
      setSaving(false);
    }
  }, [user?.id, saving, selectedIds, profile?.profileImage, reloadProfile]);

  const renderSkill: ListRenderItem<Skill> = useCallback(
    ({ item }: { item: Skill }) => (
      <SkillCard
        skill={item}
        isSelected={selectedIds.has(item.id)}
        onToggle={toggleSkill}
        cardSize={CARD_SIZE}
      />
    ),
    [selectedIds, toggleSkill, CARD_SIZE],
  );
  return (
    <SafeAreaView style={st.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <View style={st.header}>
        <View style={st.searchWrap}>
          <Ionicons
            name="search"
            size={s(20)}
            color="#575757"
            style={{ marginRight: s(3) }}
          />
          <TextInput
            style={st.searchInput}
            placeholder="Search skills..."
            placeholderTextColor="#575757"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
        {!searchQuery.trim() && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={st.tabs}
            contentContainerStyle={st.tabsContent}
          >
            {CATEGORIES.map((cat) =>
              cat === activeCategory ? (
                <LinearGradient
                  key={cat}
                  colors={["#6D4AFF", "#6340f0"]}
                  style={st.tabActive}
                >
                  <TouchableOpacity onPress={() => setActiveCategory(cat)}>
                    <Text style={st.tabTextActive}>{cat}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              ) : (
                <TouchableOpacity
                  key={cat}
                  style={st.tabInactive}
                  onPress={() => setActiveCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={st.tabTextInactive}>{cat}</Text>
                </TouchableOpacity>
              ),
            )}
          </ScrollView>
        )}
      </View>
      <FlatList
        data={filtered}
        renderItem={renderSkill}
        keyExtractor={(item) => `${item.id}_${item.name}`}
        numColumns={2}
        columnWrapperStyle={st.row}
        contentContainerStyle={st.gridContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        ListEmptyComponent={
          <View style={st.emptyWrap}>
            <Text style={st.emptyText}>No skills found 🔎</Text>
          </View>
        }
      />
      <View style={[st.bottomArea, { paddingBottom: insets.bottom + vs(12) }]}>
        <Text style={[st.countText, selectedIds.size > 0 && st.countActive]}>
          {selectedIds.size === 0
            ? "Select your skills"
            : `${selectedIds.size} skill${selectedIds.size !== 1 ? "s" : ""} selected`}
        </Text>
        <TouchableOpacity
          onPress={handleContinue}
          disabled={selectedIds.size === 0 || saving}
          activeOpacity={0.85}
        >
          {selectedIds.size > 0 ? (
            <LinearGradient
              colors={["#6D4AFF", "#603dea"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.continueBtn}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={st.continueBtnText}>Continue</Text>
              )}
            </LinearGradient>
          ) : (
            <View style={[st.continueBtn, st.continueBtnOff]}>
              <Text style={st.continueBtnText}>Continue</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
SkillSelection.whyDidYouRender = true;
const st = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: s(20),
    paddingBottom: vs(4),
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
    borderRadius: s(50),
    paddingHorizontal: s(16),
    marginBottom: vs(10),
    marginTop: vs(5),
  },
  searchInput: {
    flex: 1,
    paddingVertical: vs(12),
    color: "#1c1b1b",
    fontSize: TYPOGRAPHY.body,
  },
  tabs: {
    marginBottom: vs(2),
    paddingVertical: vs(4),
    marginHorizontal: -s(20),
  },
  tabsContent: {
    gap: s(8),
    paddingHorizontal: s(20),
  },
  tabActive: {
    paddingHorizontal: s(20),
    paddingVertical: vs(9),
    borderRadius: s(50),
  },
  tabInactive: {
    paddingHorizontal: s(20),
    paddingVertical: vs(9),
    borderRadius: s(50),
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: vs(2) },
    shadowOpacity: 0.06,
    shadowRadius: s(4),
    elevation: 2,
  },
  tabTextActive: {
    fontSize: TYPOGRAPHY.body,
    fontWeight: "600",
    color: "#fff",
  },
  tabTextInactive: {
    fontSize: TYPOGRAPHY.body,
    fontWeight: "500",
    color: "#888",
  },
  gridContent: {
    paddingHorizontal: s(14),
    paddingBottom: vs(12),
    paddingTop: vs(5),
    marginLeft: vs(4),
    marginRight: vs(4),
  },
  row: {
    justifyContent: "space-between",
    marginBottom: vs(10),
  },
  gradBorder: {
    borderRadius: s(22),
    padding: s(2.5),
  },
  cardInner: {
    backgroundColor: "#fff",
    borderRadius: s(20),
    padding: s(20),
    paddingTop: vs(10),
    minHeight: vs(120),
  },
  card: {
    borderRadius: s(20),
    padding: s(22),
    paddingTop: vs(12),
    minHeight: vs(123),
    position: "relative",
  },
  cardUnsel: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: s(2), height: vs(3) },
    shadowOpacity: 0.11,
    shadowRadius: s(8),
    elevation: 3,
  },
  checkCircle: {
    position: "absolute",
    top: vs(10),
    right: s(10),
    width: s(24),
    height: s(24),
    borderRadius: s(12),
    alignItems: "center",
    justifyContent: "center",
  },
  checkUnch: {
    backgroundColor: "#f0f0f5",
    borderWidth: 2,
    borderColor: "#e5e5eb",
  },
  iconWrap: {
    marginTop: vs(10),
    marginBottom: vs(10),
    alignItems: "flex-start",
  },
  skillName: {
    fontSize: ms(13),
    fontWeight: "700",
    color: "#1a1a2e",
    letterSpacing: -0.2,
  },
  emptyWrap: { alignItems: "center", paddingVertical: vs(40) },
  emptyText: { fontSize: ms(15), fontWeight: "600", color: "#aaa" },
  bottomArea: {
    paddingHorizontal: s(20),
    paddingTop: vs(10),
    backgroundColor: "#fff",
  },
  countText: {
    textAlign: "center",
    fontSize: ms(13),
    fontWeight: "700",
    color: "#aaa",
    marginBottom: vs(10),
  },
  countActive: { color: "#6D4AFF" },
  continueBtn: {
    borderRadius: s(50),
    paddingVertical: vs(16),
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtnOff: { backgroundColor: "#d0d0dc" },
  continueBtnText: {
    color: "#fff",
    fontSize: ms(16),
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
