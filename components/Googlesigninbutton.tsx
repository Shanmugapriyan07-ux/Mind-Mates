import React, { memo, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";

// Google "G" logo rendered as text — matches brand colors without an asset file
const GoogleG = memo(() => (
  <View style={styles.gContainer}>
    <Text style={styles.gText}>G</Text>
  </View>
));

GoogleG.displayName = "GoogleG";

interface GooglesigninbuttonProps {
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

function Googlesigninbutton({
  onPress,
  isLoading = false,
  disabled = false,
}: GooglesigninbuttonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || isLoading;

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
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
    >
      <Animated.View
        style={[
          styles.button,
          isDisabled && styles.buttonDisabled,
          { transform: [{ scale }], opacity },
        ]}
      >
        {/* Left: Google G or spinner */}
        <View style={styles.leftSection}>
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color="#5F6368"
              style={styles.spinner}
            />
          ) : (
            <GoogleG />
          )}
        </View>

        {/* Center: label */}
        <Text
          style={[styles.label, isLoading && styles.labelLoading]}
          numberOfLines={1}
        >
          {isLoading ? "Signing in…" : "Continue with Google"}
        </Text>

        {/* Right: spacer to keep label centered */}
        <View style={styles.rightSection} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

export default memo(Googlesigninbutton);

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#DADCE0",
    height: 48,
    paddingHorizontal: 12,
    width: "100%",
    ...Platform.select({
      android: { elevation: 1 },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 1.5,
      },
    }),
  },
  buttonDisabled: {
    backgroundColor: "#F8F9FA",
    borderColor: "#E8EAED",
  },
  leftSection: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  rightSection: {
    width: 36,
  },
  gContainer: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  gText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4285F4",
    fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
    lineHeight: 22,
    includeFontPadding: false,
  },
  spinner: {
    width: 22,
    height: 22,
  },
  label: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "500",
    color: "#3C4043",
    letterSpacing: 0.15,
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif-medium",
    }),
  },
  labelLoading: {
    color: "#9AA0A6",
  },
});
