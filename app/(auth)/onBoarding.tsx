/**
 * Onboarding.tsx — Production-Responsive Refactor
 *
 * Key architectural decisions (Instagram/Google pattern):
 *
 * 1. SCREEN DIMENSIONS via useWindowDimensions()
 *    – Reacts to orientation changes and foldables.
 *    – All sizing derived from live { width, height }, not hardcoded constants.
 *
 * 2. topHalf uses flex: IMAGE_FLEX (0.45 of screen) instead of fixed vs(340).
 *    – On a 5" phone this is ~310px. On a tablet it's ~430px. Both feel right.
 *
 * 3. Image sizing:
 *    – Width capped at Math.min(width * 0.9, 420) — never overflows, never looks tiny.
 *    – Height derived from width * IMAGE_ASPECT — preserves art direction ratio.
 *    – No marginTop, no left offset — centred by parent's justifyContent/alignItems.
 *
 * 4. bottomHalf layout (Instagram onboarding pattern):
 *    ┌──────────────────────┐
 *    │ topGroup             │ ← title + subtitle (flex-start, no fixed height)
 *    ├──────────────────────┤
 *    │ spacer (flex: 1)     │ ← absorbs ALL extra space
 *    ├──────────────────────┤
 *    │ dotContainer         │ ← always fixed distance above button via gap/marginBottom
 *    ├──────────────────────┤
 *    │ button               │ ← always visible at bottom
 *    └──────────────────────┘
 *    No top/bottom/left/right offsets anywhere.
 *
 * 5. textBlock drops fixed minHeight — uses paddingBottom instead so the
 *    spacer still fills correctly but text can never clip on small screens.
 *
 * 6. Dots moved OUTSIDE topGroup and placed right above the button in the
 *    natural flex column — this is the WhatsApp/Instagram pattern where dots
 *    sit in the lower section, not attached to text.
 *
 * 7. All SPACING tokens replaced with derived responsive values.
 */

import images from "@/constants/images";
import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { memo, useCallback, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Design tokens ────────────────────────────────────────────────────────────
const DOT_SIZE = s(10);
const ACTIVE_WIDTH = s(24);
const IMAGE_ASPECT = 1.05; // height / width ratio of onboarding illustrations

// How much of the screen height the image panel occupies.
// 0.44 matches the visual weight of the original vs(340) on a 760px-tall phone.
const IMAGE_FLEX = 0.44;

const SLIDES = [
  {
    id: "1",
    image: images.firstImage,
    title: "Welcome to Mindmates!",
    subtitle:
      "Mindmates connects you with people nearby who share your passions and interests. Learn, share and grow together!",
  },
  {
    id: "2",
    image: images.secondImage,
    title: "Your interests. Your city. Your circle",
    subtitle:
      "Select what you love and let Mindmates connect you with like-minded people around you who share the same passions, skills, and mindsets.",
  },
  {
    id: "3",
    image: images.thirdImage,
    title: "Grow Together!",
    subtitle:
      "Where your interests bring you — connect with people who understand your passions and interests.",
  },
];

// ─── Dot component ────────────────────────────────────────────────────────────
const Dot = memo(
  ({ index, activeIndex }: { index: number; activeIndex: number }) => {
    const dotStyle = useAnimatedStyle(() => {
      const isActive = activeIndex === index;
      return {
        width: withSpring(isActive ? ACTIVE_WIDTH : DOT_SIZE, {
          damping: 20,
          stiffness: 150,
          mass: 0.5,
        }),
        opacity: withTiming(isActive ? 1 : 0.25, { duration: 200 }),
      };
    });
    return <Animated.View style={[styles.dot, dotStyle]} />;
  },
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function Onboarding() {
  // CHANGE 1: Live screen dimensions — adapts to orientation + foldables
  const { width, height } = useWindowDimensions();

  const [currentIndex, setCurrentIndex] = useState(0);
  const isAnimating = useRef(false);
  const imageOpacity = useSharedValue(1);
  const textOpacity = useSharedValue(1);

  // CHANGE 2: Image size derived from live width, not hardcoded s(400)/vs(450)
  const imageWidth = Math.min(width * 0.88, 420);
  const imageHeight = imageWidth * IMAGE_ASPECT;

  // CHANGE 3: Top panel height is a proportion of screen height, not fixed
  const topPanelHeight = height * IMAGE_FLEX;

  const goToNext = useCallback(() => {
    if (isAnimating.current) return;
    const nextIndex = currentIndex + 1;
    if (currentIndex === SLIDES.length - 1) {
      router.replace("/(auth)/Google");
      return;
    }
    isAnimating.current = true;
    imageOpacity.value = withTiming(0, {
      duration: 250,
      easing: Easing.out(Easing.quad),
    });
    textOpacity.value = withTiming(0, {
      duration: 250,
      easing: Easing.out(Easing.quad),
    });
    setTimeout(() => {
      setCurrentIndex(nextIndex);
      imageOpacity.value = withTiming(1, {
        duration: 350,
        easing: Easing.in(Easing.quad),
      });
      textOpacity.value = withTiming(1, {
        duration: 350,
        easing: Easing.in(Easing.quad),
      });
      setTimeout(() => {
        isAnimating.current = false;
      }, 350);
    }, 260);
  }, [currentIndex]);

  const animatedImageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));
  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const slide = SLIDES[currentIndex];
  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {/*
        CHANGE 4: topHalf height is a runtime value (height * IMAGE_FLEX)
        instead of the fixed vs(340). Applied via inline style so it reacts
        to useWindowDimensions updates (e.g., orientation change).
      */}
      <View style={[styles.topHalf, { height: topPanelHeight }]}>
        <Animated.Image
          source={slide.image}
          style={[
            animatedImageStyle,
            {
              // CHANGE 5: No more marginTop / left offset.
              // Parent's justifyContent:"center" + alignItems:"center" centres it.
              // Width and height are proportional to the live screen dimensions.
              width: imageWidth,
              height: imageHeight,
            },
          ]}
          resizeMode="contain"
        />
      </View>

      {/*
        bottomHalf: pure flex column, no justifyContent override.
        Layout contract:
          topGroup  → flex-start (natural)
          spacer    → flex: 1 (absorbs all remaining space)
          dotContainer → natural height, marginBottom locks gap to button
          button    → natural height, always last
        Nothing uses top/bottom/left/right positioning.
      */}
      <View style={styles.bottomHalf}>

        {/* TOP GROUP — title + subtitle only. No dots here (they moved down). */}
        <View style={styles.topGroup}>
          <Animated.View style={[styles.textBlock, animatedTextStyle]}>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>
          </Animated.View>
        </View>

        {/* SPACER — the only element that stretches. Everything else is fixed. */}
        <View style={styles.spacer} />

        {/*
          CHANGE 6: Dots moved here — between spacer and button.
          marginBottom creates a fixed gap to the button edge.
          No top/bottom offsets. This is the WhatsApp / Instagram pattern.
        */}
        <View style={styles.dotContainer}>
          {SLIDES.map((_, i) => (
            <Dot key={i} index={i} activeIndex={currentIndex} />
          ))}
        </View>

        {/* BUTTON — always last in the column, paddingBottom on parent keeps it off the edge */}
        <TouchableOpacity
          style={styles.button}
          onPress={goToNext}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {isLast ? "Get Started " : "Continue "}
          </Text>
          <Ionicons name="arrow-forward" size={s(18)} color="#fff" />
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  // CHANGE 7: No height here — injected as inline style from useWindowDimensions.
  topHalf: {
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    // overflow: hidden protects against any image bleed on very small screens
    overflow: "hidden",
  },

  // CHANGE 8: paddingTop/paddingHorizontal/paddingBottom stay.
  // justifyContent removed — spacer pattern handles distribution.
  bottomHalf: {
    flex: 1,
    backgroundColor: "#000000",
    paddingTop: vs(22),
    paddingHorizontal: s(25),
    paddingBottom: vs(32),
    alignItems: "center",
  },

  topGroup: {
    width: "100%",
    alignItems: "center",
  },

  // CHANGE 9: minHeight removed — replaced with paddingBottom so the block
  // never clips text but also never wastes rigid space on small screens.
  textBlock: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: s(4),
    paddingBottom: vs(8),
    justifyContent: "flex-start",
  },

  title: {
    color: "#ffffff",
    fontSize: ms(26),
    fontWeight: "700",
    textAlign: "center",
    marginBottom: vs(10),
    marginTop: vs(4),
  },

  subtitle: {
    color: "#cccccc",
    fontSize: ms(18),
    textAlign: "center",
    lineHeight: ms(26),
  },

  spacer: {
    flex: 1,
  },

  // CHANGE 10: bottom: SPACING.md removed. marginBottom creates a clean
  // gap between dots and button purely via layout flow — no positioning hacks.
  dotContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: vs(16),
  },

  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "#6D4AFF",
    marginHorizontal: s(4),
  },

  // CHANGE 11: top: SPACING.md removed. Button is naturally last in the
  // flex column; paddingBottom on parent handles the safe bottom gap.
  button: {
    backgroundColor: "#6D4AFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: vs(16),
    borderRadius: s(32),
    width: "100%",
  },

  buttonText: {
    color: "#ffffff",
    fontSize: ms(18),
    fontWeight: "600",
    marginRight: s(4),
  },
});