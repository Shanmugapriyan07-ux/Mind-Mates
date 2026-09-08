// components/profile/ProfileSkeleton.tsx
import { s, vs } from "@/utils/scale";
import React, { useEffect } from "react";
import { Animated, ScrollView, StyleSheet, View } from "react-native";

export const SkeletonBox = ({
  width,
  height,
  borderRadius = s(8),
  style,
}: {
  width: any;
  height: any;
  borderRadius?: number;
  style?: any;
}) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: "#E5E7EB", opacity },
        style,
      ]}
    />
  );
};

export const ProfileSkeleton = ({
  contentPaddingBottom = vs(60),
}: {
  contentPaddingBottom?: number;
}) => (
  <ScrollView
    contentContainerStyle={[sk.scroll, { paddingBottom: contentPaddingBottom }]}
    showsVerticalScrollIndicator={false}
  >
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
      <SkeletonBox width="75%" height={vs(14)} />
    </View>
  </ScrollView>
);

const sk = StyleSheet.create({
  scroll: { paddingTop: vs(8) },
});