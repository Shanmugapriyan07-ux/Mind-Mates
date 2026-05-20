import { signInWithGoogle } from "@/services/authServices";
import { selError, selIsSigningIn, useAuthStore } from "@/stores/authStore";
import React, { useCallback, useEffect, useRef } from "react";
import {
    Dimensions,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Googlesigninbutton from "../../components/Googlesigninbutton";
import images from "../../constants/images";
import { useAppLinks } from "../../Contexts/AppLinksContexts";
import { useAuthh } from "../../Contexts/authContext";
import { useOpenLink } from "../../hooks/useOpenLink";

Dimensions.get("window");
export const Welcome = () => {
  const { clearGoogleError } = useAuthh();
  const { openByKey } = useOpenLink();
  useAppLinks();
  const isSigningIn = useAuthStore(selIsSigningIn);
  const error = useAuthStore(selError);
  const setError = useAuthStore((s) => s.setError);
   const contentOpacity   = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue:  1,
        duration: 500,
        delay:    100,
        useNativeDriver: true,
      }),
      Animated.spring(contentTranslate, {
        toValue:     0,
        delay:       100,
        useNativeDriver: true,
        damping:     20,
        stiffness:   120,
      }),
    ]).start();
  }, []);

  const tap = useCallback(
    (key: string, name: string) => () => openByKey(key, name),
    [openByKey],
  );
  useEffect(() => {
    clearGoogleError();
  }, []);
  const handleLogin = useCallback(async () => {
    await signInWithGoogle();
  }, []);
  const dismissError = useCallback(() => setError(null), [setError]);
  return (
    <SafeAreaView style={styles.container}>
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
            onPress={handleLogin}
            isLoading={isSigningIn}
            disabled={isSigningIn}
          />
        </View>
        <View style={{ bottom: 92, paddingHorizontal: 1 }}>
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
        <View style={styles.version}>
          <Text
            style={{
              color: "#6D4AFF",
              fontSize: 13,
              textAlign: "center",
              top: 10,
            }}
          >
            Mind-Mates V.11.33
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  version: {
    color: "#6D4AFF",
    left: 0,
    right: 0,
    textAlign: "center",
    alignSelf: "center",
    bottom: 0,
  },
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
  bottomHalf: {
    height: 450,
    backgroundColor: "#000000",
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 36,
    alignItems: "center",
  },
  textBlock: {
    alignItems: "center",
    flex: 1,
  },
  authSection: {
    width: "100%",
    gap: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
    marginTop: 4,
    bottom: 9,
  },
  subtitle: {
    color: "#cccccc",
    fontSize: 17,
    textAlign: "center",
    lineHeight: 26,
    bottom: 8,
    marginLeft: 10,
    marginRight: 10,
  },
});

export default Welcome;

