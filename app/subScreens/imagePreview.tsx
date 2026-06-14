import { useAuthh } from "@/Contexts/authContext";
import { useProfile } from "@/Contexts/profileContext";
import { useProfileImage } from "@/hooks/useProfileImage";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
    Dimensions,
    Image,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    Animated,
    View
} from "react-native";
import { s, vs, ms } from "@/utils/scale";
import {
    SafeAreaView,
} from "react-native-safe-area-context";
const { width: W } = Dimensions.get("window");
const IMAGE_SIZE = W * 0.78;
export default function ImagePreviewScreen() {
  const { user } = useAuthh();
  const { profile } = useProfile();
  const { userId: viewedUserId } = useLocalSearchParams<{ userId?: string }>();
  const isOwnProfile = !viewedUserId || viewedUserId === user?.id;
  const { imageUri, uploading, error } = useProfileImage();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.88)).current;
  const sheetY = useRef(new Animated.Value(220)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.spring(imageScale, {
        toValue: 1,
        tension: 70,
        friction: 100,
        useNativeDriver: true,
      }),
      Animated.spring(sheetY, {
        toValue: 0,
        tension: 70,
        friction: 100,
        useNativeDriver: true,
        delay: 10,
      }),
    ]).start();
  }, []);
  const dismiss = () => {
  Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.spring(imageScale, {
        toValue: 1,
        tension: 70,
        friction: 100,
        useNativeDriver: true,
      }),
      Animated.spring(sheetY, {
        toValue: 0,
        tension: 70,
        friction: 100,
        useNativeDriver: true,
        delay: 10,
      }),
    ]).start(() => { router.back(); });
  };
  const initials = (profile?.fullName ?? user?.name ?? "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const displayImage = isOwnProfile ? imageUri : profile?.profileImage;
  const isBusy = uploading;
  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" />
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
      <SafeAreaView style={st.topBar} edges={["top"]}>
        <TouchableOpacity
          style={st.closeBtn}
          onPress={dismiss}
          disabled={isBusy}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={st.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </SafeAreaView>
      <View style={st.imageSection}>
        <Animated.View style={[{ transform: [{ scale: imageScale }] }]}>
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
        </Animated.View>
        {!!error && <Text style={st.errorText}>{error}</Text>}
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  androidBlur: { backgroundColor: "rgb(255, 255, 255)" },
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
    top: s(15),
    left: s(5),
  },
  closeBtnText: {
    color: "#6D4AFF",
    fontSize: ms(16),
    fontWeight: "600",
    lineHeight: ms(20),
  },
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
    borderWidth: s(2),
    borderColor: "#6D4AFF",
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
  initials: { fontSize: IMAGE_SIZE * 0.32, fontWeight: "700", color: "#fff" },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: IMAGE_SIZE / 2,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: s(8),
  },
  uploadPercent: { color: "#fff", fontSize: ms(16), fontWeight: "700" },
  name: {
    marginTop: vs(20),
    fontSize: ms(22),
    fontWeight: "700",
    color: "#fff",
    letterSpacing: s(0.3),
  },
  errorText: {
    marginTop: vs(10),
    color: "#FCA5A5",
    fontSize: ms(13),
    textAlign: "center",
    paddingHorizontal: s(32),
  }
});
