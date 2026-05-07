import React, { useEffect } from 'react';
import { StyleSheet, View, Image, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

Dimensions.get('window');

// ── MUST MATCH app.json splash backgroundColor exactly ────────────
const SPLASH_BG   = '#FFFFFF';
const LOGO_SIZE   = 120;       // px — adjust to your logo dimensions
const LOGO_START  = 0.72;      // initial scale (Gmail uses ~0.7)
const HOLD_MS     = 100;       // ms to hold at full size before fade
const FADE_OUT_MS = 220;       // ms for fade-out (shorter = snappier)

interface Props {
  onAnimationComplete: () => void;
}

const AnimatedSplash: React.FC<Props> = ({ onAnimationComplete }) => {
  // Shared values run on UI thread — animation is isolated from JS load
  const scale   = useSharedValue(LOGO_START);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // ── Phase 1: Instant fade-in + spring scale-up ────────────
    // Spring physics: damping=18 stiffness=200 gives Gmail-like
    // natural ease-out that decelerates smoothly at full size.
    // NOT a linear or cubic-bezier — springs feel more alive.
    opacity.value = withTiming(1, { duration: 80 });
    scale.value   = withSpring(1, {
      damping:   18,
      stiffness: 200,
      mass:      0.8,
    });

    // ── Phase 2: Hold → fade-out → notify JS ─────────────────
    // withDelay(700ms) = wait for spring to settle
    // withTiming(0, 220ms) = fast fade-out
    // runOnJS(fn) = safe way to call React setState from UI thread
    const totalDelay = 700 + HOLD_MS;
    opacity.value = withSequence(
      withTiming(1, { duration: 80 }),          // instant on
      withDelay(totalDelay,                      // hold while spring plays
        withTiming(0, {
          duration: FADE_OUT_MS,
          easing: Easing.out(Easing.ease),
        }, (finished) => {
          if (finished) {
            // This callback runs on UI thread — must use runOnJS to touch React state
            runOnJS(onAnimationComplete)();
          }
        })
      )
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        {/* Replace with your actual logo */}
        <Image
          source={require('../assets/images/splash-logo.png')}
          style={styles.logo}
          resizeMode="contain"
          // fadeDuration=0 prevents React Native's own image fade — we control it
          fadeDuration={0}
        />
      </Animated.View>

      {/* Optional: app name below logo (like Gmail) */}
      {/* <Animated.Text style={[styles.appName, logoStyle]}>MindMates</Animated.Text> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BG,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          9999,  // always on top during transition
  },
  logoWrap: {
    alignItems:  'center',
    justifyContent: 'center',
  },
  logo: {
    width:  LOGO_SIZE,
    height: LOGO_SIZE,
  },
  appName: {
    marginTop:  16,
    fontSize:   22,
    fontWeight: '700',
    color:      '#6D4AFF',
    letterSpacing: -0.5,
  },
});

// React.memo: this component never needs to re-render after mount
export default React.memo(AnimatedSplash);

