// components/AuthTransitionOverlay.tsx
// Fullscreen branded overlay shown during logout and delete.
// This MASKS the navigation transition — user sees smooth branded screen
// instead of intermediate auth screens flashing.
//
// Instagram strategy: show your brand during EVERY auth transition.
// Never let users see raw navigation.

import { selPhase, useAuthStore } from "@/stores/authStore";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";

const { width, height } = Dimensions.get("window");

function AuthTransitionOverlay() {
  const phase = useAuthStore(selPhase);
  const isVisible = phase === "logging_out" || phase === "deleting";

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const dotAnim1 = useRef(new Animated.Value(0.3)).current;
  const dotAnim2 = useRef(new Animated.Value(0.3)).current;
  const dotAnim3 = useRef(new Animated.Value(0.3)).current;

  // Dot animation loop
  const startDots = () => {
    const dot = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );

    Animated.parallel([
      dot(dotAnim1, 0),
      dot(dotAnim2, 200),
      dot(dotAnim3, 400),
    ]).start();
  };

  useEffect(() => {
    if (isVisible) {
      startDots();
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  const message =
    phase === "deleting" ? "Deleting your account…" : "Signing out…";

  // Always render — controls visibility via opacity
  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ scale }],
          pointerEvents: isVisible ? "auto" : "none",
        },
      ]}
      pointerEvents={isVisible ? "auto" : "none"}
    >
      <LinearGradient
        colors={["#1a1a2e", "#16213e", "#0f3460"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ambient glow */}
      <View style={styles.glow} />

      {/* Logo */}
      <View style={styles.logoBox}>
        <Text style={styles.logoChar}>M</Text>
      </View>

      <Text style={styles.appName}>Mind-Mates</Text>

      <Text style={styles.message}>{message}</Text>

      {/* Animated dots */}
      <View style={styles.dots}>
        <Animated.View style={[styles.dot, { opacity: dotAnim1 }]} />
        <Animated.View style={[styles.dot, { opacity: dotAnim2 }]} />
        <Animated.View style={[styles.dot, { opacity: dotAnim3 }]} />
      </View>
    </Animated.View>
  );
}

export default memo(AuthTransitionOverlay);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a2e",
  },
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#6C63FF",
    opacity: 0.07,
  },
  logoBox: {
    width: 110,
    height: 110,
    borderRadius: 32,
    backgroundColor: "#6C63FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    elevation: 16,
  },
  logoChar: {
    fontSize: 52,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  appName: {
    fontSize: 30,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 36,
  },
  message: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 24,
    letterSpacing: 0.2,
  },
  dots: {
    flexDirection: "row",
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6C63FF",
  },
});
