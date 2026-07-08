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
const IMAGE_ASPECT = 1.07;
const IMAGE_FLEX = 0.4;

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

export default function Onboarding() {
  const { width, height } = useWindowDimensions();

  const [currentIndex, setCurrentIndex] = useState(0);
  const isAnimating = useRef(false);
  const imageOpacity = useSharedValue(1);
  const textOpacity = useSharedValue(1);
  const topPanelHeight = height * IMAGE_FLEX;
  const imageWidth = Math.min(width * 1.3, 402);
  const imageHeight = Math.min(
    imageWidth * IMAGE_ASPECT,
    topPanelHeight * 1.5,
  );

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
      <View style={[styles.topHalf, { height: topPanelHeight }]}>
        <Animated.Image
          source={slide.image}
          style={[
            animatedImageStyle,
            {
              width: imageWidth,
              height: imageHeight,
            },
          ]}
          resizeMode="contain"
        />
      </View>

      <View style={styles.bottomHalf}>
        <View style={styles.topGroup}>
          <Animated.View style={[styles.textBlock, animatedTextStyle]}>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>
          </Animated.View>
        </View>
        <View style={styles.spacer} />
     
        <View style={styles.dotContainer}>
          {SLIDES.map((_, i) => (
            <Dot key={i} index={i} activeIndex={currentIndex} />
          ))}
        </View>
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
  topHalf: {
    backgroundColor: "#ffffff",
    justifyContent: "flex-start",
    alignItems: "center",
    overflow: "hidden",
    left: s(5)
  },
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
  textBlock: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: s(4),
    paddingBottom: vs(8),
    justifyContent: "flex-start",
  },

  title: {
    color: "#ffffff",
    fontSize: ms(25),
    fontWeight: "700",
    textAlign: "center",
    marginBottom: vs(10),
    marginTop: vs(4),
  },

  subtitle: {
    color: "#cccccc",
    fontSize: ms(17),
    textAlign: "center",
    lineHeight: ms(26),
  },

  spacer: {
    flex: 1,
  },
  dotContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: vs(20),
  },

  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "#6D4AFF",
    marginHorizontal: s(4),
  },
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
