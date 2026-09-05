import { cdnProfileUrl } from "@/lib/cloudinaryUpload";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, ViewStyle } from "react-native";
const loadedUris = new Set<string>();
const COLORS = [
  "#7C3AED",
  "#2563EB",
  "#059669",
  "#D97706",
  "#DC2626",
  "#0891B2",
  "#65A30D",
  "#9333EA",
];
const nameColor = (name: string): string =>
  COLORS[
    name.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length
  ];
const nameInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
interface Props {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: ViewStyle;
}
export const ProfileAvatar = React.memo(function ProfileAvatar({
  uri,
  name = "",
  size = 56,
  style,
}: Props) {
  const normalizedUri = uri
    ? uri.includes("cloudinary.com")
      ? cdnProfileUrl(uri, size)
      : uri
    : null;
  const alreadyLoaded = !!normalizedUri && loadedUris.has(normalizedUri);
  const [, setReady] = useState(alreadyLoaded);
  const fadeAnim = useRef(new Animated.Value(alreadyLoaded ? 1 : 0)).current;
  useEffect(() => {
    if (!normalizedUri) {
      setReady(false);
      fadeAnim.setValue(0);
      return;
    }
    if (
      loadedUris.has(normalizedUri) ||
      normalizedUri.startsWith("file://") ||
      normalizedUri.startsWith("data:") ||
      normalizedUri.startsWith("blob:")
    ) {
      setReady(true);
      fadeAnim.setValue(1);
    } else {
      setReady(false);
      fadeAnim.setValue(0);
    }
  }, [fadeAnim, normalizedUri]);

  const onLoad = () => {
    if (normalizedUri) loadedUris.add(normalizedUri);
    setReady(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };
  const onError = () => {
    if (normalizedUri) loadedUris.delete(normalizedUri);
    setReady(false);
    fadeAnim.setValue(0);
  };
  const bg = name ? nameColor(name) : "#7C3AED";
  const fontSize = size * 0.34;
  return (
    <View
      style={[
        s.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      {!!name && (
        <Text style={[s.initials, { fontSize }]} numberOfLines={1}>
          {nameInitials(name)}
        </Text>
      )}
      {!!normalizedUri && (
        <Animated.View
          style={[
            s.img,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: fadeAnim,
            },
          ]}
        >
          <Image
            source={{ uri: normalizedUri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            onLoad={onLoad}
            onError={onError}
          />
        </Animated.View>
      )}
    </View>
  );
});

export const clearAvatarCache = (url: string) => {
  loadedUris.delete(url);
};
export const clearAllAvatarCache = () => {
  loadedUris.clear();
};



const s = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initials: { color: "#fff", fontWeight: "700", position: "absolute" },
  img: { position: "absolute", top: 0, left: 0, resizeMode: "cover" },
});

export default ProfileAvatar;
