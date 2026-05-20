import { useAuthh } from "@/Contexts/authContext";
import images from "@/constants/images";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const { loginWithOAuth } = useAuthh();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const hasProcessed = useRef(false);

  // Pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = params.code as string | undefined;
      if (code) {
        console.log("🔑 Exchanging OAuth code for session...");
        const { data, error } =
          await supabase.auth.exchangeCodeForSession(code);
        if (error) throw new Error(error.message);
        console.log("✅ OAuth session created:", data.user?.email);
      } else {
        // No code — maybe user already has a session (tab reopened etc.)
        console.log("ℹ️ No code param — checking existing session");
        await loginWithOAuth();
      }
    } catch (err: any) {
      console.error("❌ Auth callback error:", err?.message);
      // If callback fails, redirect to login
    }
  };

  return (
    <View style={s.container}>
      <Animated.View style={[s.logoWrap, { opacity: pulseAnim }]}>
        <Image source={images.splash} style={s.logo} resizeMode="contain" />
      </Animated.View>
      <Text style={s.text}>Signing you in...</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logo: { width: 54, height: 54 },
  text: { fontSize: 15, color: "#6B7280" },
});
