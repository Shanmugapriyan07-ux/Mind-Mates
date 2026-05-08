import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Googlesigninbutton from "../../components/Googlesigninbutton";
import { isNativeGoogleAvailable } from "../../config/googleAuth";
import images from "../../constants/images";
import { useAppLinks } from "../../Contexts/AppLinksContexts";
import { useAuthh } from "../../Contexts/authContext";
import { useAuth } from "../../hooks/useAuth";
import { useOpenLink } from "../../hooks/useOpenLink";
import supabase from "../../lib/supabase";

Dimensions.get("window");

// Remove this before production
const handleMockLogin = async () => {
  // Simulate successful Google login with a test Supabase account
  const { error } = await supabase.auth.signInWithPassword({
    email: "shanmugapriyancse582@gmail.com",
    password: "Artist@123.",
  });
  if (error) console.error("Mock login failed:", error.message);
};

// In your UI — add a temporary button:

// ─── Main Onboarding ──────────────────────────────────────────────────────────
export const Welcome = () => {
  const { googleLogin, clearGoogleError } = useAuthh();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { openByKey } = useOpenLink();
  const { isStale, refresh } = useAppLinks();
  const { isSigningIn, error, clearError } = useAuth();
  const tap = useCallback(
    (key: string, name: string) => () => openByKey(key, name),
    [openByKey],
  );

  useEffect(() => {
    clearGoogleError();
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    // googleLogin() handles all logic:
    //   - Shows native account picker
    //   - Exchanges token with Supabase
    //   - Returns null (success/cancel) or error string
    // After success, onAuthStateChange fires → _layout.tsx routes automatically
    await googleLogin();
  }, [googleLogin]);

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top: Image area ────────────────────────────────────────────── */}
      <View style={styles.topHalf}>
        <Image
          source={images.splash}
          style={[styles.image]}
          resizeMode="contain"
        />
      </View>

      <View style={styles.bottomHalf}>
        <Animated.View style={[styles.textBlock]}>
          <Text style={styles.title}>Welcome to our Mindmates!</Text>
          <Text style={styles.subtitle}>
            Sign in with your Google account to get started
          </Text>
        </Animated.View>

        <View style={styles.authSection}>
          <Googlesigninbutton
            onPress={handleGoogleLogin}
            isLoading={isSigningIn}
            disabled={isSigningIn}
          />

          {/* Error banner — only shown for real errors, not cancellation */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                onPress={clearError}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Text style={styles.errorDismiss}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* In your UI — add a temporary button: */}
        {__DEV__ && !isNativeGoogleAvailable() && (
          <TouchableOpacity onPress={handleMockLogin} style={styles.mockButton}>
            <Text style={styles.mockText}>
              🧪 Dev Mock Login (Expo Go only)
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ bottom: 110, paddingHorizontal: 1 }}>
          <Text style={{ color: "#cccccc", fontSize: 14, textAlign: "center" }}>
            By continuing, you agree to our{" "}
            <Text
              style={{ color: "#6D4AFF" }}
              onPress={tap("TERMS_OF_SERVICE", "Terms of Service")}
            >
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text
              style={{ color: "#6D4AFF" }}
              onPress={tap("PRIVACY_POLICY", "Privacy Policy")}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>

        <TouchableOpacity onPress={() => router.push("/(auth)/Login")}>
          <View>
            <Text style={{ color: "white" }}>login</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  // ── Top white half ──
  topHalf: {
    height: 340,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 250,
    top: 20,
  },

  // ── Bottom black half ──
  bottomHalf: {
    height: 450,
    backgroundColor: "#000000",
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 36,
    alignItems: "center",
  },

  // ── Dots ──

  // ── Text ──
  textBlock: {
    alignItems: "center",
    flex: 1,
  },
  authSection: {
    width: "100%",
    gap: 12,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#B91C1C",
    lineHeight: 18,
  },
  errorDismiss: {
    fontSize: 13,
    color: "#9CA3AF",
    marginLeft: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
    marginTop: 10,
    bottom: 9,
  },
  googleButtonDisabled: {
    backgroundColor: "#F8F9FA",
    borderColor: "#E8EAED",
  },
  iconSlot: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  gLetter: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4285F4",
    fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
    includeFontPadding: false,
  },
  googleLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "500",
    color: "#3C4043",
    letterSpacing: 0.15,
  },
  googleLabelMuted: {
    color: "#9AA0A6",
  },

  subtitle: {
    color: "#cccccc",
    fontSize: 17,
    textAlign: "center",
    lineHeight: 26,
    bottom: 5,
    marginLeft: 10,
    marginRight: 10,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
    height: 53,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 48,
    bottom: 120,
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleIcon: {
    width: 20,
    height: 20,
    right: 5,
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
    right: 5,
  },
  mockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
    height: 53,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 48,
    bottom: 120,
  },
  mockText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
    right: 5,
  },
});

export default Welcome;
