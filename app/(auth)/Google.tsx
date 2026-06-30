import Googlesigninbutton from "@/components/Googlesigninbutton";
import images from "@/constants/images";
import { useAppLinks } from "@/Contexts/AppLinksContexts";
import { useOpenLink } from "@/hooks/useOpenLink";

import { signInWithGoogle } from "@/services/authServices";
import {
  selIsSigningIn,
  selIsTransitioning,
  useAuthStore,
} from "@/stores/authStore";
import { ms, s, vs } from "@/utils/scale";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Image,
  InteractionManager,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
const IMAGE_PANEL_FLEX = 0.42;

const Welcome = () => {
  const { width, height } = useWindowDimensions();

  const { openByKey } = useOpenLink();
  useAppLinks();

  const isSigningIn = useAuthStore(selIsSigningIn);
  const isTransitioning = useAuthStore(selIsTransitioning);
  const setError = useAuthStore((st) => st.setError);

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(24)).current;
  const topPanelHeight = height * IMAGE_PANEL_FLEX;
  const splashImageHeight = Math.min(topPanelHeight * 0.80, 280);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      useAuthStore.getState().setTransitioning?.(false);
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslate, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 140,
        }),
      ]).start();
    });
    return () => task.cancel();
  }, []);
  useEffect(() => {
    if (isTransitioning) {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [isTransitioning]);
  useEffect(() => {
    setError(null);
  }, []);
  const tap = useCallback(
    (key: string, name: string) => () => openByKey(key, name),
    [openByKey],
  );
  const handleLogin = useCallback(async () => {
    await signInWithGoogle();
  }, []);
  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.topHalf, { height: topPanelHeight }]}>
        <Image
          source={images.splash}
          style={[
            styles.image,
            {
        
              height: splashImageHeight,
            }
          ]}
          resizeMode="contain"
        />
      </View>

      
      <View style={styles.bottomHalf}>

        <Animated.View
          style={[
            styles.textBlock,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslate }],
            },
          ]}
        >
          <Text style={styles.title}>Welcome to our Mindmates!</Text>
          <Text style={styles.subtitle}>
            Sign in with your Google account to get started
          </Text>
        </Animated.View>
        <View style={styles.spacer} />
        <Animated.View
          style={[styles.authSection, { opacity: contentOpacity }]}
        >
          <Googlesigninbutton
            onPress={handleLogin}
            isLoading={isSigningIn || isTransitioning}
            disabled={isSigningIn || isTransitioning}
          />
        </Animated.View>
        <Animated.View
          style={[styles.bottomGroup, { opacity: contentOpacity }]}
        >
          <Text style={styles.legalText}>
            By continuing, you agree to our{" "}
            <Text
              style={styles.legalLink}
              onPress={tap("TERMS_OF_SERVICE", "Terms of Service")}
            >
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text
              style={styles.legalLink}
              onPress={tap("PRIVACY_POLICY", "Privacy Policy")}
            >
              Privacy Policy
            </Text>
            .
          </Text>
          <Text style={styles.versionText}>Mind Mates V.11.33</Text>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  topHalf: {
    backgroundColor: "#6D4AFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  image: {
    width: "100%",
  },

  bottomHalf: {
    flex: 1,
    backgroundColor: "#000000",
    paddingTop: vs(28),
    paddingHorizontal: s(28),
    paddingBottom: vs(36),
    alignItems: "center",
  },

  textBlock: {
    alignItems: "center",
    width: "100%",
  },

  title: {
    color: "#ffffff",
    fontSize: ms(24),
    fontWeight: "700",
    textAlign: "center",
    marginTop: vs(4),
    marginBottom: vs(10),
  },

  subtitle: {
    color: "#cccccc",
    fontSize: ms(17),
    textAlign: "center",
    lineHeight: ms(26),
    marginLeft: s(10),
    marginRight: s(10),
  },
  spacer: {
    flex: 1,
  },
  authSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  bottomGroup: {
    alignItems: "center",
    width: "100%",
    gap: vs(8),
    alignSelf: "center",
  },
  legalText: {
    color: "#cccccc",
    fontSize: ms(14),
    textAlign: "center",
    paddingHorizontal: s(1),
    alignSelf: "center",
  },

  legalLink: {
    color: "#6D4AFF",
  },

  versionText: {
    color: "#6D4AFF",
    fontSize: ms(13),
    textAlign: "center",
  },
});

export default Welcome;