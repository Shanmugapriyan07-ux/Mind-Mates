import images from "@/constants/images";
import { Image } from "expo-image";
import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
const LOGO_SIZE = 140;
const SPLASH_BG = "#6D4AFF";
interface Props {
  onComplete?: () => void;
}
const AnimatedSplash: React.FC<Props> = ({ onComplete }) => {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const bgOpacity = useSharedValue(1);
  const started = useRef(false);
  const startTime = useRef(Date.now());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startTime.current = Date.now();
    logoOpacity.value = withSequence(
      withTiming(1, {
        duration: 250,
        easing: Easing.inOut(Easing.ease),
      }),
      withTiming(1, { duration: 550 }),
      withTiming(0, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      }),
    );
    logoScale.value = withSequence(
      withSpring(1.0, {
        damping: 16,
        stiffness: 150,
        mass: 0.8,
        overshootClamping: true,
      }),
      withTiming(1.0, { duration: 600 }),
      withTiming(1.1, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      }),
    );
    bgOpacity.value = withDelay(
      400,
      withTiming(0, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      }),
    );
    // const completionDelay = setTimeout(() => {
    //   const elapsed = Date.now() - startTime.current;
    //   const remaining = Math.max(0, MIN_SHOW_MS - elapsed);
    //   setTimeout(() => {
    //     onCompleteRef.current?.();
    //   }, remaining);
    // }, 600);
    const completionDelay = setTimeout(() => {
      onCompleteRef.current?.();
    }, 600);
    return () => clearTimeout(completionDelay);
  }, [bgOpacity, logoOpacity, logoScale]);
  const containerStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  return (
    <Animated.View
      style={[styles.container, containerStyle]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image
          source={images.splash}
          style={styles.logo}
          contentFit="contain"
          cachePolicy="memory-disk"
          onError={(error) => console.warn("[Splash] Image load error:", error)}
        />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BG,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});

export default React.memo(AnimatedSplash);
