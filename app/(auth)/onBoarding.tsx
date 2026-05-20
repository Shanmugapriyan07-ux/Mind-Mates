import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import images from '@/constants/images';
Dimensions.get('window');
const slides = [
  {
    id: '1',
    image: images.firstImage,
    title: 'Welcome to Mindmates!',
    subtitle:
      'Mindmates connects you with people nearby who share your passions and interests. Learn, share and grow together!',
  },
  {
    id: '2',
    image: images.secondImage,
    title: "Your interests. Your city. Your circle",
    subtitle:
      'Select what you love and let Mindmates connect you with like-minded people around you who share the same passions, skills, and mindsets.',
  },
  {
    id: '3',
    image: images.thirdImage,
    title: 'Grow Together!',
    subtitle:
      'Where your interests bring you — connect with people who understand your passions and interests.',
  },
];
const DOT_SIZE = 10;
const ACTIVE_WIDTH = 24;
const Dot = ({ index, activeIndex }: { index: number; activeIndex: number; key?: any }) => {
  const dotStyle = useAnimatedStyle(() => {
    const isActive = activeIndex === index;
    return {
      width: withSpring(isActive ? ACTIVE_WIDTH : DOT_SIZE, {
        damping: 150,
        stiffness: 120,
        mass: 0.5,
        overshootClamping: true,
      }),
      opacity: withTiming(isActive ? 1 : 0.35, { duration: 150 }),
    };
  });

  return <Animated.View style={[styles.dot, dotStyle]} />;
};
export default function Onboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const imageOpacity = useSharedValue(1);
  const imageTranslateY = useSharedValue(0);
  const textOpacity = useSharedValue(1);
  const textTranslateY = useSharedValue(0);
  const goToNext = () => {
    const nextIndex = currentIndex + 1;
    if (currentIndex === slides.length - 1) {
      router.replace('/(auth)/Google');
      return;
    }
    imageOpacity.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) });
    imageTranslateY.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) });
    textOpacity.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) });
    textTranslateY.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) });
    setTimeout(() => {
      setCurrentIndex(nextIndex);
      imageTranslateY.value = 1;
      textTranslateY.value = 1;
      imageOpacity.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) });
      imageTranslateY.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) });
      textOpacity.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) });
      textTranslateY.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) });
    }, 260);
  };
  const animatedImageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ translateY: imageTranslateY.value }],
  }));
  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));
  const slide = slides[currentIndex];
  const isLast = currentIndex === slides.length - 1;
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHalf}>
        <Animated.Image
          source={slide.image}
          style={[styles.image, animatedImageStyle]}
          resizeMode="contain"
        />
      </View>
      <View style={styles.bottomHalf}>
        <View style={styles.dotContainer}>
          {slides.map((_, i) => (
            <Dot key={i} index={i} activeIndex={currentIndex} />
          ))}
        </View>
        <Animated.View style={[styles.textBlock, animatedTextStyle]}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
        </Animated.View>
        <TouchableOpacity
          style={styles.button}
          onPress={goToNext}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {isLast ? 'Get Started ' : 'Continue '}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topHalf: {
    height: 340,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 440,
    top: 58,
    left: 10,
  },
  bottomHalf: {
    height: 450,
    backgroundColor: '#000000',
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 50,
    alignItems: 'center',
  },
  dotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    top: 250,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#6D4AFF',
    marginHorizontal: 4,
  },
  textBlock: {
    alignItems: 'center',
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 18,
    bottom:16
  },
  subtitle: {
    color: '#cccccc',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    bottom:13
  },
  button: {
    backgroundColor: '#6D4AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 72,
    paddingVertical: 16,
    borderRadius: 32,
    width: '100%',
    bottom:20
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});