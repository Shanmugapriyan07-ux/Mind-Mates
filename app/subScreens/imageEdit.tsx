import { useAuthh } from "@/Contexts/authContext";
import { useProfile } from "@/Contexts/profileContext";
import { useProfileImage } from "@/hooks/useProfileImage";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
const { width: W } = Dimensions.get("window");
const IMAGE_SIZE = W * 0.78;
export default function ImageEditScreen() {
  const { user } = useAuthh();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const { userId: viewedUserId } = useLocalSearchParams<{ userId?: string }>();
  const isOwnProfile = !viewedUserId || viewedUserId === user?.id;
  const {
    imageUri,
    uploading,
    progress,
    error,
    pickFromGallery,
    uploadAndSave,
    removePhoto,
  } = useProfileImage();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.88)).current;
  const sheetY = useRef(new Animated.Value(220)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 1,
        useNativeDriver: true,
      }),
      Animated.spring(imageScale, {
        toValue: 1,
        tension: 50,
        friction: 300,
        useNativeDriver: true,
      }),
      Animated.spring(sheetY, {
        toValue: 0,
        tension: 50,
        friction: 300,
        useNativeDriver: true,
        delay: 1,
      }),
    ]).start();
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 10,
        useNativeDriver: true,
      }),
      Animated.timing(imageScale, {
        toValue: 1,
        duration: 10,
        useNativeDriver: true,
      }),
      Animated.timing(sheetY, {
        toValue: 1,
        duration: 10,
        useNativeDriver: true,
      }),
    ]).start(() => router.back());
  };

  const initials = (profile?.fullName ?? user?.name ?? "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const displayImage = isOwnProfile ? imageUri : profile?.profileImage;
  const hasNewImage =
    isOwnProfile && !!imageUri && imageUri !== profile?.profileImage;
  const isBusy = uploading;

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!hasNewImage) {
      dismiss();
      return;
    }
    uploadAndSave(); 
    dismiss(); 
  };

  // ── Remove ────────────────────────────────────────────────────────────────
  const handleRemove = async () => {
    await removePhoto();
    dismiss();
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={90}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.androidBlur]} />
        )}
      </Animated.View>

      {/* ── Close button ──────────────────────────────────────────────────── */}
      <SafeAreaView style={s.topBar} edges={["top"]}>
        <TouchableOpacity
          style={s.closeBtn}
          onPress={dismiss}
          disabled={isBusy}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Save button top-right — own profile only, only when new image picked */}
        {isOwnProfile && hasNewImage && (
          <TouchableOpacity
            style={s.saveTopBtn}
            onPress={handleSave}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#ededff" size="small" />
            ) : (
              <Text style={s.saveTopBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* ── Profile image — centered, large ───────────────────────────────── */}
      <View style={s.imageSection}>
        <Animated.View style={[{ transform: [{ scale: imageScale }] }]}>
          {displayImage ? (
            <Image
              source={{ uri: displayImage }}
              style={s.image}
              resizeMode="cover"
            />
          ) : (
            <View style={s.initialsCircle}>
              <Text style={s.initials}>{initials}</Text>
            </View>
          )}

          {/* Upload progress overlay */}
          {uploading && (
            <View style={s.uploadOverlay}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={s.uploadPercent}>{progress}%</Text>
            </View>
          )}
        </Animated.View>

        {/* Name under image */}
        {profile?.fullName ? (
          <Text style={s.name}>{profile.fullName}</Text>
        ) : null}

        {/* Error */}
        {!!error && <Text style={s.errorText}>{error}</Text>}
      </View>

      {/* ── Action sheet — OWN PROFILE ONLY ───────────────────────────────── */}
      {isOwnProfile && (
        <Animated.View
          style={[
            s.sheet,
            { paddingBottom: insets.bottom + 12 },
            { transform: [{ translateY: sheetY }] },
          ]}
        >
          {/* Edit Photo */}
          <TouchableOpacity
            style={[s.sheetBtn, s.sheetBtnEdit]}
            onPress={Platform.OS === "web" ? pickFromGallery : pickFromGallery}
            disabled={isBusy}
            activeOpacity={0.75}
          >
            <View style={s.sheetBtnIcon}>
              <Text style={s.sheetBtnIconText}>
                {" "}
                <Ionicons
                  name="create-outline"
                  size={24}
                  color="#6D4AFF"
                  style={{ alignSelf: "center",right:5 }}
                />
              </Text>
            </View>
            <View style={s.sheetBtnContent}>
              <Text style={s.sheetBtnTitle}>Edit Photo</Text>
              <Text style={s.sheetBtnSub}>Choose from gallery</Text>
            </View>
            <Text style={s.sheetBtnArrow}>›</Text>
          </TouchableOpacity>

          <View style={s.divider} />
          {!!imageUri && (
            <TouchableOpacity
              style={[s.sheetBtn, s.sheetBtnDelete]}
              onPress={handleRemove}
              disabled={isBusy}
              activeOpacity={0.75}
            >
              <View style={[s.sheetBtnIcon, s.sheetBtnIconRed]}>
                <Text style={s.sheetBtnIconText}>
                  <Ionicons name="remove" size={24} color="#ca3535" />
                </Text>
              </View>
              <View style={s.sheetBtnContent}>
                <Text style={[s.sheetBtnTitle, s.sheetBtnTitleRed]}>
                  Delete Photo
                </Text>
                <Text style={s.sheetBtnSub}>Remove your profile picture</Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const SHEET_RADIUS = 24;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },

  // Backdrop
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  androidBlur: { backgroundColor: "rgba(0,0,0,0.88)" },

  // Top bar
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  closeBtnText: {
    color: "#6D4AFF",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 20,
  },
  saveTopBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    marginTop: 15,
  },
  saveTopBtnText: { color: "#6D4AFF", fontSize: 15, fontWeight: "700" },

  // Image section
  imageSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: IMAGE_SIZE / 2,
    borderWidth: 3,
    borderColor: "#6D4AFF",
    marginBottom: 25,
  },
  initialsCircle: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: IMAGE_SIZE / 2,
    backgroundColor: "#6D4AFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.2)",
  },
  initials: { fontSize: IMAGE_SIZE * 0.32, fontWeight: "700", color: "#fff" },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: IMAGE_SIZE / 2,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadPercent: { color: "#6D4AFF", fontSize: 18, fontWeight: "700" },
  name: {
    marginTop: 5,
    fontSize: 22,
    fontWeight: "700",
    color: "#6D4AFF",
    letterSpacing: 0.3,
    marginBottom: 40,
  },
  errorText: {
    marginTop: 10,
    color: "#FCA5A5",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 32,
  },

  // Action sheet
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingTop: 12,
    paddingHorizontal: 16,
  },

  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  sheetBtnEdit: {},
  sheetBtnDelete: {},

  sheetBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  sheetBtnIconRed: { backgroundColor: "rgba(255,255,255,0.18)" },
  sheetBtnIconText: { fontSize: 20 },

  sheetBtnContent: { flex: 1 },
  sheetBtnTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F9FAFB",
    marginBottom: 2,
  },
  sheetBtnTitleRed: { color: "#ffffff" },
  sheetBtnSub: { fontSize: 12, color: "#6B7280" },
  sheetBtnArrow: { fontSize: 22, color: "#4B5563", marginLeft: 8 },

  divider: {
    height: 1,
    backgroundColor: "rgba(37, 36, 36, 0.07)",
    marginVertical: 2,
  },
});
