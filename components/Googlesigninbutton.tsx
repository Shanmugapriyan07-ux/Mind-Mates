// components/GoogleSignInButton.tsx
import icons from "@/constants/icons";
import { useAuthStore } from "@/stores/authStore";
import { ms, s, vs } from "@/utils/scale";
import React, { memo, useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";

interface GoogleSignInButtonProps {
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}
function GoogleSignInButton({
  onPress,
  isLoading = false,
  disabled = false,
}: GoogleSignInButtonProps) {
  // Also read transitioning from store for the smooth handoff
  const isTransitioning = useAuthStore((s: any) => s.isTransitioning ?? false);

  // Either prop-driven loading OR store-driven transitioning = show spinner
  const showSpinner = isLoading || isTransitioning;
  const isDisabled = disabled || showSpinner;

  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  // Separate animated value for the transitioning fade-out
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // When transitioning starts, gently fade the button towards 0.5 opacity
  // so it visually "dissolves" into the navigation — not a hard cutoff.
  useEffect(() => {
    if (isTransitioning) {
      Animated.timing(fadeAnim, {
        toValue: 1, // Keep fully opaque to prevent "ash" look
        duration: 350,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [isTransitioning]);

  const handlePressIn = useCallback(() => {
    if (isDisabled) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.965,
        useNativeDriver: true,
        speed: 60,
        bounciness: 0,
      }),
      Animated.timing(opacity, {
        toValue: 0.82,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isDisabled, scale, opacity]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 40,
        bounciness: 4,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity]);

  return (
    <TouchableWithoutFeedback
      onPress={isDisabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: isDisabled, busy: showSpinner }}
    >
      <Animated.View
        style={[
          styles.button,
          isDisabled && styles.buttonDisabled,
          {
            transform: [{ scale }],
            // Combine press opacity + transitioning fade
            // When disabled, we'll rely on the existing opacity animations for visual feedback.
            opacity: Animated.multiply(opacity, fadeAnim),
          },
        ]}
      >
        <View style={styles.leftSection}>
          {showSpinner ? (
            <ActivityIndicator
              size="small" // Keep size small
              color="#6D4AFF" // Changed spinner color to match the default text color for visibility on white
              style={styles.spinner}
            />
          ) : (
            <Image
              source={icons.google}
              style={{ width: s(22), height: s(23), left: s(18) }}
            />
          )}
        </View>

        <Text
          style={[styles.label, showSpinner && styles.labelLoading]} // Always use the default label style
          numberOfLines={1}
        >
          {showSpinner ? "Signing in…" : "Continue with Google"}
        </Text>

        <View style={styles.rightSection} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

export default memo(GoogleSignInButton);

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#DADCE0",
    height: 60,
    paddingHorizontal: s(12),
    width: "100%",
    bottom: vs(100),
    ...Platform.select({
      android: { elevation: s(1) },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: s(1) },
        shadowOpacity: 0.15,
        shadowRadius: s(1.5),
      },
    }),
  },
  buttonDisabled: {
    backgroundColor: "#FFFFFF", 
    borderColor: "#DADCE0",
  },
  leftSection: {
    width: s(36),
    alignItems: "center",
    justifyContent: "center",
  },
  rightSection: {
    width: s(36),
  },
  spinner: {
    width: s(22),
    height: s(22),
  },
  labelLoading: {
    color: "#6D4AFF",
  },
  label: {
    flex: 1,
    textAlign: "center",
    fontSize: ms(18),
    fontWeight: "600",
    left: s(7),
    color: "#3C4043",
    letterSpacing: s(0.15),
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif-medium",
    }),
  },
});
