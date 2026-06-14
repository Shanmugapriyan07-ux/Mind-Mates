import { useAuthh } from "@/Contexts/authContext";
import { useProfile } from "@/Contexts/profileContext";
import { useProfileImage } from "@/hooks/useProfileImage";
import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
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
// original: W * 0.78 — ratio kept, scales automatically with device width
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

  const handleSave = () => {
    if (!hasNewImage) {
      dismiss();
      return;
    }
    uploadAndSave();
    dismiss();
  };
  const handleRemove = async () => {
    await removePhoto();
    dismiss();
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" />

      {/* Backdrop */}
      <Animated.View style={[st.backdrop, { opacity: backdropOpacity }]}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={90}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, st.androidBlur]} />
        )}
      </Animated.View>

      {/* Top bar — original: paddingHorizontal 20, paddingTop 8 */}
      <SafeAreaView style={st.topBar} edges={["top"]}>
        <TouchableOpacity
          style={st.closeBtn}
          onPress={dismiss}
          disabled={isBusy}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={st.closeBtnText}>✕</Text>
        </TouchableOpacity>
        {isOwnProfile && hasNewImage && (
          <TouchableOpacity
            style={st.saveTopBtn}
            onPress={handleSave}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#ededff" size="small" />
            ) : (
              <Text style={st.saveTopBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Image */}
      <View style={st.imageSection}>
        <Animated.View style={{ transform: [{ scale: imageScale }] }}>
          {displayImage ? (
            <Image
              source={{ uri: displayImage }}
              style={st.image}
              resizeMode="cover"
            />
          ) : (
            <View style={st.initialsCircle}>
              <Text style={st.initials}>{initials}</Text>
            </View>
          )}
          {uploading && (
            <View style={st.uploadOverlay}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={st.uploadPercent}>
                {Math.min(Math.round(progress), 100)}%
              </Text>
            </View>
          )}
        </Animated.View>
        {!!error && <Text style={st.errorText}>{error}</Text>}
      </View>

      {/* Bottom sheet */}
      {isOwnProfile && (
        <Animated.View
          style={[
            st.sheet,
            { paddingBottom: insets.bottom + vs(12) },
            { transform: [{ translateY: sheetY }] },
          ]}
        >
          <TouchableOpacity
            style={[st.sheetBtn, st.sheetBtnEdit]}
            onPress={pickFromGallery}
            disabled={isBusy}
            activeOpacity={0.75}
          >
            <View style={st.sheetBtnIcon}>
              <Ionicons
                name="create-outline"
                size={s(24)}
                color="#ffffff"
                style={{ alignSelf: "center" }}
              />
            </View>
            <View style={st.sheetBtnContent}>
              <Text style={st.sheetBtnTitle}>Edit Photo</Text>
              <Text style={st.sheetBtnSub}>Choose from gallery</Text>
            </View>
            <Text style={st.sheetBtnArrow}>›</Text>
          </TouchableOpacity>

          <View style={st.divider} />

          {!!imageUri && (
            <TouchableOpacity
              style={[st.sheetBtn, st.sheetBtnDelete]}
              onPress={handleRemove}
              disabled={isBusy}
              activeOpacity={0.75}
            >
              <View style={[st.sheetBtnIcon, st.sheetBtnIconRed]}>
                <Ionicons name="remove" size={s(24)} color="#ffffff" />
              </View>
              <View style={st.sheetBtnContent}>
                <Text style={[st.sheetBtnTitle, st.sheetBtnTitleRed]}>
                  Delete Photo
                </Text>
                <Text style={st.sheetBtnSub}>Remove your profile picture</Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const SHEET_RADIUS = s(24);

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  androidBlur: { backgroundColor: "rgb(255,255,255)" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: s(20),
    paddingTop: vs(8),
  },
  closeBtn: {
    width: s(38),
    height: s(38),
    borderRadius: s(19),
    backgroundColor: "#ececec",
    alignItems: "center",
    justifyContent: "center",
    marginTop: vs(15),
  },
  closeBtnText: {
    color: "#6D4AFF",
    fontSize: ms(14),
    fontWeight: "600",
    lineHeight: ms(20),
  },
  saveTopBtn: {
    paddingHorizontal: s(18),
    paddingVertical: vs(8),
    borderRadius: s(20),
    backgroundColor: "#ececec",
    marginTop: vs(15),
  },
  saveTopBtnText: { color: "#6D4AFF", fontSize: ms(14), fontWeight: "600" },

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
    borderWidth: s(3),
    borderColor: "#6D4AFF",
    marginBottom: vs(25),
  },
  initialsCircle: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: IMAGE_SIZE / 2,
    backgroundColor: "#6D4AFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: s(3),
    borderColor: "rgba(255,255,255,0.2)",
  },
  // original: fontSize IMAGE_SIZE * 0.32 — ratio kept
  initials: { fontSize: IMAGE_SIZE * 0.32, fontWeight: "700", color: "#fff" },

  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: IMAGE_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: vs(8),
  },
  // original: fontSize 18, fontWeight 700
  uploadPercent: { color: "#6D4AFF", fontSize: ms(18), fontWeight: "700" },

  // original: marginTop 10, fontSize 13
  errorText: {
    marginTop: vs(10),
    color: "#FCA5A5",
    fontSize: ms(13),
    textAlign: "center",
    paddingHorizontal: s(32),
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingTop: vs(12),
    paddingHorizontal: s(16),
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: s(2), height: vs(4) },
    shadowOpacity: 0.8,
    shadowRadius: s(8),
  },

  // original: paddingVertical 14, paddingHorizontal 4, borderRadius 14
  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: vs(14),
    paddingHorizontal: s(4),
    borderRadius: s(14),
  },
  sheetBtnEdit: {},
  sheetBtnDelete: {},

  // original: width 44, height 44, borderRadius 12, marginRight 14
  sheetBtnIcon: {
    width: s(44),
    height: s(44),
    borderRadius: s(12),
    backgroundColor: "#6D4AFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: s(13),
  },
  sheetBtnIconRed: { backgroundColor: "#6D4AFF" },

  sheetBtnContent: { flex: 1 },

  // original: fontSize 16, fontWeight 600, marginBottom 2
  sheetBtnTitle: {
    fontSize: ms(15),
    fontWeight: "600",
    color: "#000000",
    marginBottom: vs(2),
  },
  sheetBtnTitleRed: { color: "#ed4e4e" },
  // original: fontSize 12
  sheetBtnSub: { fontSize: ms(12), color: "#6B7280" },
  // original: fontSize 22, marginLeft 8
  sheetBtnArrow: { fontSize: ms(20), color: "#4B5563", marginLeft: s(8) },

  divider: {
    height: 1,
    backgroundColor: "rgba(37,36,36,0.07)",
    marginVertical: vs(2),
  },
});
