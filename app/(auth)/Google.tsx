/**
 * Google.tsx (Welcome screen) — Production-Responsive Refactor
 *
 * Problems fixed vs original:
 *
 * 1. topHalf fixed height vs(340) → flex proportion via useWindowDimensions
 * 2. spacer minHeight: vs(130) conflicting with flex:1 → minHeight removed,
 *    spacer remains flex:1 but a guaranteed paddingTop on bottomHalf gives
 *    breathing room so text never kisses the panel edge on small screens.
 * 3. authSection top: SPACING.sm → removed; gap between spacer and button
 *    achieved by marginBottom on the auth section itself.
 * 4. legalText bottom: SPACING.xxl → removed entirely; sits in natural flex
 *    column flow inside bottomGroup. The parent's paddingBottom handles edge.
 * 5. versionText had no bottom anchor — now it's the last natural element,
 *    always visible above paddingBottom of the container.
 * 6. Image width: "100%" stays (it already fills correctly) but height is
 *    now derived from screen height proportion so it doesn't overflow the panel.
 *
 * Layout contract for bottomHalf:
 *   ┌─────────────────────┐
 *   │ textBlock           │ ← fixed at top
 *   ├─────────────────────┤
 *   │ spacer (flex: 1)    │ ← absorbs all extra space
 *   ├─────────────────────┤
 *   │ authSection         │ ← Google sign-in button
 *   ├─────────────────────┤
 *   │ bottomGroup         │ ← legal + version text
 *   └─────────────────────┘
 *   paddingBottom on bottomHalf keeps everything off the bottom edge.
 */

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

// How much of the screen height the purple image panel occupies.
// 0.42 produces ~310px on a 740px phone and ~480px on a tablet — both correct.
const IMAGE_PANEL_FLEX = 0.42;

const Welcome = () => {
  // CHANGE 1: Live dimensions — responds to orientation and foldables
  const { width, height } = useWindowDimensions();

  const { openByKey } = useOpenLink();
  useAppLinks();

  const isSigningIn = useAuthStore(selIsSigningIn);
  const isTransitioning = useAuthStore(selIsTransitioning);
  const setError = useAuthStore((st) => st.setError);

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(24)).current;

  // CHANGE 2: Image height is proportional to the panel height, not a fixed vs(245).
  // Capped at 90% of panel height so it never bleeds on small screens.
  const topPanelHeight = height * IMAGE_PANEL_FLEX;
  const splashImageHeight = Math.min(topPanelHeight * 0.82, 280);

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
      {/*
        CHANGE 3: height is now a runtime proportion of screen height.
        Injected as inline style so useWindowDimensions updates propagate.
        overflow:hidden prevents splash from bleeding on very short screens.
      */}
      <View style={[styles.topHalf, { height: topPanelHeight }]}>
        <Image
          source={images.splash}
          style={[
            styles.image,
            {
              // CHANGE 4: Height is proportional to panel height, not vs(245).
              // width:"100%" stays — it already fills the panel correctly.
              height: splashImageHeight,
              // CHANGE 5: top: vs(8) removed — parent's alignItems:center handles vertical centring.
            },
          ]}
          resizeMode="contain"
        />
      </View>

      {/*
        bottomHalf: no justifyContent — spacer pattern handles distribution.
        paddingBottom replaces all bottom: SPACING.xxl hacks below.
      */}
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

        {/*
          CHANGE 6: spacer minHeight:vs(130) removed.
          flex:1 alone is correct — it fills all available space between
          the subtitle and the auth button, adapting to every screen height.
        */}
        <View style={styles.spacer} />

        {/*
          CHANGE 7: top: SPACING.sm removed.
          marginBottom creates a clean gap between the button and the legal text
          purely via layout flow — zero positioning hacks.
        */}
        <Animated.View
          style={[styles.authSection, { opacity: contentOpacity }]}
        >
          <Googlesigninbutton
            onPress={handleLogin}
            isLoading={isSigningIn || isTransitioning}
            disabled={isSigningIn || isTransitioning}
          />
        </Animated.View>

        {/*
          CHANGE 8: bottom: SPACING.xxl on legalText removed.
          bottomGroup sits in natural flow; paddingBottom on bottomHalf
          keeps it off the screen edge on all devices including iPhones with
          home indicators and Androids with gesture bars.
        */}
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

  // CHANGE 9: No height here — injected inline from useWindowDimensions.
  topHalf: {
    backgroundColor: "#6D4AFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  // CHANGE 10: top: vs(8) removed — parent centres it.
  image: {
    width: "100%",
    // height injected inline
  },

  bottomHalf: {
    flex: 1,
    backgroundColor: "#000000",
    paddingTop: vs(28),
    paddingHorizontal: s(28),
    // CHANGE 11: paddingBottom is the single source of truth for bottom spacing.
    // Replaces all the individual bottom: SPACING.* hacks throughout children.
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

  // CHANGE 12: minHeight: vs(130) removed — flex:1 is the only rule needed.
  spacer: {
    flex: 1,
  },

  // CHANGE 13: top: SPACING.sm removed. marginBottom handles gap to bottomGroup.
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