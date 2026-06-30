import { useAuthh } from "@/Contexts/authContext";
import { useProfile } from "@/Contexts/profileContext";
import {
  cdnProfileUrl,
  compressForUpload,
  uploadToCloudinary,
} from "@/lib/cloudinaryUpload";
import { saveDraft } from "@/lib/profileDraft";
import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
export default function ProfileImageScreen() {
  const { user } = useAuthh();
  const { updateProfile, profile } = useProfile();
  const { width } = useWindowDimensions();
  const AVATAR_SIZE = width * 0.38;
  const insets = useSafeAreaInsets();
  const [imageUri, setImageUri] = useState<string | null>(
    profile?.profileImage ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const avatarScale = useRef(new Animated.Value(1)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);
  const webFileRef = useRef<File | null>(null);
  useEffect(
    () => () => {
      isMounted.current = false;
    },
    [],
  );
  const handleAvatarPressIn = () =>
    Animated.spring(avatarScale, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start();
  const handleAvatarPressOut = () => {
    Animated.spring(avatarScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
    if (typeof document !== "undefined") {
      triggerWebFilePicker();
      return;
    }
    openSheet();
  };
  const triggerWebFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = async (e: any) => {
      const file: File = e.target.files?.[0];
      document.body.removeChild(input);
      if (!file?.type.startsWith("image/")) return;
      webFileRef.current = file;
      setImageUri(URL.createObjectURL(file));
    };
    input.oncancel = () => document.body.removeChild(input);
    input.click();
  };
  const openSheet = () => {
    setShowPicker(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 280,
      stiffness: 180,
    }).start();
  };
  const closeSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => setShowPicker(false));
  };
  const processImage = async (uri: string) => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1080 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  };
  const pickFromGallery = useCallback(async () => {
    if (typeof document !== "undefined") {
      triggerWebFilePicker();
      closeSheet();
      return;
    }
    closeSheet();
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Toast.show({ type: "error", text1: "Permission needed" });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setImageUri(await processImage(result.assets[0].uri));
  }, []);

  const takePhoto = useCallback(async () => {
    closeSheet();
    if (typeof document !== "undefined") return;
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Toast.show({ type: "error", text1: "Camera permission needed" });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setImageUri(await processImage(result.assets[0].uri));
  }, []);

  const removePhoto = useCallback(() => {
    setImageUri(null);
    closeSheet();
  }, []);

  const uploadImage = useCallback(
    async (localUri: string): Promise<string | null> => {
      setUploading(true);
      setUploadProgress(0);
      try {
        let uploadUri = localUri;
        if (typeof document !== "undefined" && webFileRef.current) {
          uploadUri = URL.createObjectURL(webFileRef.current);
        } else if (Platform.OS !== "web") {
          uploadUri = await compressForUpload(localUri, "profile");
        }
        const result = await uploadToCloudinary(uploadUri, {
          type: "image",
          onProgress: (pct: number) => setUploadProgress(pct),
          uploadType: "profile",
        });
        const cdnUrl = cdnProfileUrl(result.secureUrl);
        if (typeof document !== "undefined" && uploadUri.startsWith("blob:")) {
          URL.revokeObjectURL(uploadUri);
          webFileRef.current = null;
        }
        return cdnUrl;
      } catch (err: any) {
        Toast.show({
          type: "error",
          text1: "Upload failed",
          text2: err?.message ?? "Try again",
        });
        return null;
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const handleNext = useCallback(async () => {
    if (!user?.id || uploading || saving) return;
    if (!imageUri || imageUri === profile?.profileImage) {
      router.push("/(profileSetUp)/SkillSelect");
      return;
    }
    setSaving(true);
    try {
      const uploadedUrl = await uploadImage(imageUri);
      if (!uploadedUrl) {
        setSaving(false);
        return;
      }
      updateProfile({ profileImage: uploadedUrl });
      saveDraft(user.id, { profileImage: uploadedUrl, currentStep: 2 }).catch(
        () => {},
      );
      setSaving(false);
      router.push("/(profileSetUp)/SkillSelect");
    } catch (e: any) {
      if (isMounted.current) setSaving(false);
    }
  }, [
    user?.id,
    uploading,
    saving,
    imageUri,
    profile?.profileImage,
    uploadImage,
    updateProfile,
  ]);

  const handleSkip = useCallback(
    () => router.push("/(profileSetUp)/SkillSelect"),
    [],
  );

  const initials = (profile?.fullName ?? user?.name ?? "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isBusy = uploading || saving;
  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  // Derived styles that depend on runtime AVATAR_SIZE
  const avatarStyle = {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  };

  return (
    <SafeAreaView style={st.container}>
      <View style={st.header}>
        <Text style={st.stepLabel}>Step 2 of 3</Text>
        <Text style={st.title}>Add a photo</Text>
        <Text style={st.subtitle}>
          Help others recognize you. You can change this any time.
        </Text>
      </View>
      <View style={st.avatarSection}>
        <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={handleAvatarPressIn}
            onPressOut={handleAvatarPressOut}
            style={[
              st.avatarWrapper,
              {
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: AVATAR_SIZE / 2,
              },
            ]}
            disabled={isBusy}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={avatarStyle} />
            ) : (
              <View style={[st.initialsCircle, avatarStyle]}>
                <Text
                  style={[st.initialsText, { fontSize: AVATAR_SIZE * 0.32 }]}
                >
                  {initials}
                </Text>
              </View>
            )}
            {!isBusy && (
              <View style={st.cameraBadge}>
                <Ionicons name="camera" size={s(16)} color="#6D4AFF" />
              </View>
            )}
            {uploading && (
              <View
                style={[st.uploadOverlay, { borderRadius: AVATAR_SIZE / 2 }]}
              >
                <ActivityIndicator color="#fff" size="large" />
                <Text style={st.progressText}>{uploadProgress}%</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
        <Text style={st.tapHint}>
          {imageUri ? "Tap to change photo" : "Tap to add photo"}
        </Text>
      </View>
      <View style={[st.actions, { marginBottom: insets.bottom + vs(8) }]}>
        <TouchableOpacity
          style={[st.nextBtn, isBusy && st.nextBtnDisabled]}
          onPress={handleNext}
          disabled={isBusy}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={st.nextBtnText}>
              {imageUri && imageUri !== profile?.profileImage
                ? "Save & Continue"
                : "Continue"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={st.skipBtn}
          onPress={handleSkip}
          disabled={isBusy}
        >
          <Text style={st.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
      <Modal
        visible={showPicker}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        <Pressable style={st.sheetBackdrop} onPress={closeSheet} />
        <Animated.View
          style={[
            st.sheet,
            {
              paddingBottom: insets.bottom + vs(16),
              transform: [{ translateY: sheetTranslate }],
            },
          ]}
        >
          <View style={st.sheetHandle} />
          <Text style={st.sheetTitle}>Profile photo</Text>
          {Platform.OS !== "web" && (
            <TouchableOpacity style={st.sheetOption} onPress={takePhoto}>
              <View style={st.iconBox}>
                <Ionicons name="camera" size={s(22)} color="#ffffff" />
              </View>
              <Text style={st.sheetOptionText}>Take photo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={st.sheetOption} onPress={pickFromGallery}>
            <View style={st.iconBox}>
              <Ionicons name="images" size={s(22)} color="#ffffff" />
            </View>
            <Text style={st.sheetOptionText}>Choose from gallery</Text>
          </TouchableOpacity>
          {imageUri && (
            <TouchableOpacity style={st.sheetOption} onPress={removePhoto}>
              <View style={st.iconBox}>
                <Ionicons name="trash" size={s(22)} color="#ffffff" />
              </View>
              <Text style={[st.sheetOptionText, { color: "#E53935" }]}>
                Remove photo
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={st.sheetCancel} onPress={closeSheet}>
            <Text style={st.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: s(24),
  },

  iconBox: {
    width: s(40),
    height: s(40),
    borderRadius: s(8),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6D4AFF",
  },

  header: {
    marginTop: vs(20),
    marginBottom: vs(30),
  },
  stepLabel: {
    fontSize: ms(12),
    fontWeight: "600",
    color: "#A0A0A0",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: vs(8),
  },
  title: {
    fontSize: ms(26),
    fontWeight: "700",
    color: "#111",
    marginBottom: vs(8),
  },
  subtitle: {
    fontSize: ms(14),
    color: "#666",
    lineHeight: ms(22),
  },
  avatarSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrapper: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: vs(8) },
    shadowOpacity: 0.12,
    shadowRadius: s(20),
    elevation: 10,
  },

  initialsCircle: {
    backgroundColor: "#6D4AFF",
    alignItems: "center",
    justifyContent: "center",
  },

  initialsText: {
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 2,
  },

  cameraBadge: {
    position: "absolute",
    bottom: vs(4),
    right: s(4),
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
  },

  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: vs(6),
  },

  progressText: {
    color: "#fff",
    fontSize: ms(13),
    fontWeight: "600",
  },
  tapHint: {
    marginTop: vs(12),
    fontSize: ms(14),
    color: "#888",
    marginBottom: vs(12),
  },
  actions: {
    gap: vs(8),
  },

  nextBtn: {
    backgroundColor: "#6D4AFF",
    borderRadius: s(14),
    height: vs(54),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6D4AFF",
    shadowOffset: { width: 0, height: vs(4) },
    shadowOpacity: 0.35,
    shadowRadius: s(12),
    elevation: 6,
  },
  nextBtnDisabled: { opacity: 0.65 },

  nextBtnText: {
    color: "#fff",
    fontSize: ms(16),
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  skipBtn: {
    height: vs(40),
    alignItems: "center",
    justifyContent: "center",
  },

  skipText: {
    color: "#999",
    fontSize: ms(14),
    fontWeight: "500",
  },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },

  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: s(24),
    borderTopRightRadius: s(24),
    paddingTop: vs(12),
    paddingHorizontal: s(20),
  },

  sheetHandle: {
    width: s(40),
    height: vs(4),
    borderRadius: s(2),
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: vs(20),
  },

  sheetTitle: {
    fontSize: ms(17),
    fontWeight: "700",
    color: "#111",
    marginBottom: vs(4),
    textAlign: "center",
  },

  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: vs(18),
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    gap: s(14),
  },

  sheetOptionText: {
    fontSize: ms(16),
    color: "#222",
    fontWeight: "500",
  },

  sheetCancel: {
    marginTop: vs(14),
    height: vs(50),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ececec",
    borderRadius: s(12),
  },

  sheetCancelText: {
    fontSize: ms(16),
    fontWeight: "600",
    color: "#555",
  },
});
