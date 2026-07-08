import LocationPicker from "@/components/LocationPicker";
import { useAuthh } from "@/Contexts/authContext";
import { useProfile } from "@/Contexts/profileContext";
import { useResponsive } from "@/hooks/useResponsive";
import { readDraft, saveDraft } from "@/lib/profileDraft";
import { RADIUS, SPACING, TYPOGRAPHY } from "@/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const BasicInfo = () => {
  const { profile, updateProfile } = useProfile();
  const { user } = useAuthh();
  const { isSmallPhone, contentMaxWidth } = useResponsive();
  const insets = useSafeAreaInsets();

  const [formData, setFormData] = useState({
    fullName: profile?.fullName ?? "",
    InterestedSkills: profile?.InterestedSkills ?? "",
    location: profile?.location ?? "",
    bio: profile?.bio ?? "",
  });
  const [focused, setFocused] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isMounted = useRef(true);

  const handleChange = useCallback((field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  }, []);

  const handleLocationSelect = useCallback((district: string) => {
    setFormData((prev: any) => ({ ...prev, location: district }));
  }, []);

  const onNameChange = useCallback(
    (t: string) => handleChange("fullName", t),
    [handleChange],
  );
  const onNameFocus = useCallback(() => setFocused("fullName"), []);
  const onNameBlur = useCallback(() => setFocused(null), []);
  const onSkillChange = useCallback(
    (t: string) => handleChange("InterestedSkills", t),
    [handleChange],
  );
  const onSkillFocus = useCallback(() => setFocused("InterestedSkills"), []);
  const onSkillBlur = useCallback(() => setFocused(null), []);
  const onLocFocus = useCallback(() => setFocused("location"), []);
  const onLocBlur = useCallback(() => setFocused(null), []);
  const onBioChange = useCallback(
    (t: string) => handleChange("bio", t),
    [handleChange],
  );
  const onBioFocus = useCallback(() => setFocused("bio"), []);
  const onBioBlur = useCallback(() => setFocused(null), []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    readDraft(user.id).then((draft) => {
      if (!draft) return;
      setFormData({
        fullName: draft.full_Name ?? "",
        InterestedSkills: draft.InterestedSkills ?? "",
        location: draft.location ?? "",
        bio: draft.bio ?? "",
      });
    });
  }, [user?.id]);

  const handleNext = useCallback(async () => {
    if (!formData.fullName.trim()) {
      Toast.show({ type: "error", text1: "Please enter your full name" });
      return;
    }
    if (!formData.location.trim()) {
      Toast.show({ type: "error", text1: "Please select your district" });
      return;
    }
    setSaving(true);
    const payload = {
      fullName: formData.fullName.trim(),
      bio: formData.bio.trim(),
      location: formData.location.trim(),
      InterestedSkills: formData.InterestedSkills,
    };
    updateProfile(payload);
    if (user?.id) {
      saveDraft(user.id, { ...payload, currentStep: 1 }).catch((e: any) =>
        console.warn("Draft save failed:", e),
      );
    }
    setSaving(false);
    setFormData({ fullName: "", InterestedSkills: "", location: "", bio: "" });
    router.push("/(profileSetUp)/ProfileImage");
  }, [formData, updateProfile, user?.id]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <View style={s.header}>
          <Text style={[s.brand, { fontSize: TYPOGRAPHY.titleLg }]}>
            MindMates
          </Text>
          <Text style={s.stepLabel}>Step 1 of 3</Text>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: SPACING.xl,
            paddingBottom: "30%",
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              alignSelf: "center",
              width: "100%",
              maxWidth: contentMaxWidth,
            }}
          >
            <Text style={s.subtitle}>Let's get to know you!</Text>

            <View style={s.inputGroup}>
              <Text style={s.label}>Full Name *</Text>
              <View
                style={[
                  s.inputWrapper,
                  focused === "fullName" && s.inputFocused,
                ]}
              >
                <Ionicons
                  name="person"
                  size={18}
                  color="#6D4AFF"
                  style={s.icon}
                />
                <TextInput
                  style={s.input}
                  placeholder="Your full name"
                  placeholderTextColor="#9CA3AF"
                  value={formData.fullName}
                  onChangeText={onNameChange}
                  onFocus={onNameFocus}
                  onBlur={onNameBlur}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>Interested Skill</Text>
              <View
                style={[
                  s.inputWrapper,
                  focused === "InterestedSkills" && s.inputFocused,
                ]}
              >
                <Ionicons
                  name="happy"
                  size={18}
                  color="#6D4AFF"
                  style={s.icon}
                />
                <TextInput
                  style={s.input}
                  placeholder="Arts & Sports"
                  placeholderTextColor="#9CA3AF"
                  value={formData.InterestedSkills}
                  onChangeText={onSkillChange}
                  onFocus={onSkillFocus}
                  onBlur={onSkillBlur}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>Location *</Text>
              <View
                style={[
                  s.inputWrapper,
                  focused === "location" && s.inputFocused,
                ]}
              >
                <Ionicons
                  name="location"
                  size={18}
                  color="#6D4AFF"
                  style={s.icon}
                />
                <View style={{ flex: 1 }}>
                  <LocationPicker
                    placeholder="Search District"
                    value={formData.location}
                    onSelect={handleLocationSelect}
                    onFocus={onLocFocus}
                    onBlur={onLocBlur}
                  />
                </View>
              </View>
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>About You</Text>
              <View
                style={[s.textAreaWrapper, focused === "bio" && s.inputFocused]}
              >
                <TextInput
                  style={[s.textArea, { minHeight: isSmallPhone ? 88 : 110 }]}
                  placeholder="Something about your passion!"
                  placeholderTextColor="#9CA3AF"
                  value={formData.bio}
                  onChangeText={onBioChange}
                  onFocus={onBioFocus}
                  onBlur={onBioBlur}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={200}
                />
              </View>
              <Text style={s.charCount}>{formData.bio.length}/200</Text>
            </View>
          </View>
        </ScrollView>
        <View
          style={[
            s.buttonContainer,
            { paddingBottom: insets.bottom + SPACING.md },
          ]}
        >
          <View
            style={{
              maxWidth: contentMaxWidth,
              width: "100%",
              alignSelf: "center",
            }}
          >
            <TouchableOpacity
              onPress={handleNext}
              activeOpacity={0.8}
              style={s.btnOuter}
              disabled={saving}
            >
              <LinearGradient
                colors={["#6D4AFF", "#6542f0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.btn}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={s.btnText}>Continue</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  kav: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  brand: {
    fontWeight: "700",
    color: "#6D4AFF",
    letterSpacing: 0.15,
  },
  stepLabel: {
    fontSize: TYPOGRAPHY.small,
    fontWeight: "600",
    color: "#A0A0A0",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: SPACING.xxs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.bodyMd,
    color: "#1F2937",
    lineHeight: 22,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    fontWeight: "500",
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.body,
    fontWeight: "600",
    color: "#374151",
    marginBottom: SPACING.xs,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    height: 50,
    paddingRight: SPACING.sm,
  },
  inputFocused: {
    borderColor: "#6D4AFF",
    backgroundColor: "#FAFAFE",
  },
  icon: {
    marginHorizontal: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.bodyMd,
    color: "#1F2937",
    paddingVertical: 0,
  },
  textAreaWrapper: {
    backgroundColor: "#F9FAFB",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: SPACING.md,
  },
  textArea: {
    fontSize: TYPOGRAPHY.bodyMd,
    color: "#1F2937",
  },
  charCount: {
    fontSize: TYPOGRAPHY.tiny,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: SPACING.xxs,
  },
  buttonContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    // paddingBottom injected inline via useSafeAreaInsets — see above
  },
  btnOuter: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    shadowColor: "#6D4AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  btn: {
    paddingVertical: SPACING.md,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: TYPOGRAPHY.bodyLg,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

export default BasicInfo;
