// components/profile/SkillDisplay.tsx
import { SKILL_ICONS, DEFAULT_SKILL_ICON } from "@/constants/skillIcons";
import { ms, s, vs } from "@/utils/scale";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FlashList } from "@shopify/flash-list";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export const SkillPill = React.memo(
  ({
    skill,
    active,
    onPress,
  }: {
    skill: string;
    active?: boolean;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[st.pill, active && st.pillActive]}
    >
      <Ionicons
        name={(SKILL_ICONS[skill] ?? DEFAULT_SKILL_ICON) as any}
        size={s(13)}
        color={active ? "#fff" : "#6D4AFF"}
        style={{ marginRight: s(5) }}
      />
      <Text style={[st.pillText, active && st.pillTextActive]}>{skill}</Text>
    </TouchableOpacity>
  ),
);

export const SkillCard = React.memo(({ skill }: { skill: string }) => (
  <View style={st.skillCard}>
    <View style={st.skillIconWrap}>
      <Ionicons
        name={(SKILL_ICONS[skill] ?? DEFAULT_SKILL_ICON) as any}
        size={s(28)}
        color="#6D4AFF"
      />
    </View>
    <Text style={st.skillName} numberOfLines={2}>
      {skill}
    </Text>
  </View>
));

export const ScrollablePills = ({ skills }: { skills: string[] }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);

  return (
    <View style={st.pillsWrapper}>
      <FlashList
        horizontal
        data={skills}
        keyExtractor={(item, index) => `${item}-${index}`}
        extraData={selectedIndex}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.pillRow}
        style={st.pillsScroll}
        renderItem={({ item, index }) => (
          <SkillPill
            skill={item}
            active={index === selectedIndex}
            onPress={() => setSelectedIndex(index)}
          />
        )}
      />
    </View>
  );
};

const st = StyleSheet.create({
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
    marginRight: s(4),
  },
  pillActive: { backgroundColor: "#6D4AFF", borderColor: "#6D4AFF" },
  pillText: { fontSize: ms(12), fontWeight: "600", color: "#374151" },
  pillTextActive: { color: "#fff" },
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
});