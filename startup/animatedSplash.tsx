
import React, { useEffect, useRef } from 'react';
import {
  StyleSheet, View, Image, Dimensions, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withSequence, withDelay,
  runOnJS, Easing,
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW, height: SH } = Dimensions.get('window');

// ── MUST match app.json splash.backgroundColor exactly ───────────
const SPLASH_BG    = '#FFFFFF';
const LOGO_SIZE    = 120;
const LOGO_START   = 0.72;   // initial scale (Gmail uses ~0.7)
const SPRING_CFG   = { damping: 18, stiffness: 200, mass: 0.8 };
const TOTAL_MS     = 900;    // total animation duration

interface Props {
  visible:     boolean;   // false = animating out (cross-fade)
  onComplete:  () => void;
}

const AnimatedSplash: React.FC<Props> = ({ visible, onComplete }) => {
  // ── Shared values (UI thread — 60fps guaranteed) ──────────────
  const logoScale   = useSharedValue(LOGO_START);
  const logoOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const splashAlpha = useSharedValue(1);   // splash container opacity

  const hasStarted = useRef(false);

  // ── Start animation on mount ──────────────────────────────────
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Phase 1: Instant fade-in + spring scale-up
    logoOpacity.value = withTiming(1, { duration: 80 });
    logoScale.value   = withSpring(1, SPRING_CFG);

    // Phase 2: Glow pulse (Spotify-style breathing effect)
    // Appears at 300ms, fades by 600ms
    glowOpacity.value = withDelay(300,
      withSequence(
        withTiming(0.6, { duration: 150, easing: Easing.out(Easing.ease) }),
        withTiming(0,   { duration: 200, easing: Easing.in(Easing.ease)  })
      )
    );

    // Phase 3: Fade out splash at 800ms
    splashAlpha.value = withDelay(800,
      withTiming(0, { duration: 220, easing: Easing.out(Easing.ease) },
        (finished) => {
          if (finished) runOnJS(onComplete)();
        }
      )
    );
  }, []);

  // ── Animated styles ───────────────────────────────────────────
  const containerStyle = useAnimatedStyle(() => ({
    opacity: splashAlpha.value,
    // When opacity = 0, disable pointer events (allow taps through)
    pointerEvents: splashAlpha.value < 0.05 ? 'none' : 'auto',
  } as any));

  const logoWrapStyle = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Background gradient — subtle premium feel */}
      <LinearGradient
        colors={['#FFFFFF', '#F8F6FF', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Glow ring behind logo (Spotify-style) */}
      <Animated.View style={[styles.glowRing, glowStyle]}>
        <LinearGradient
          colors={['rgba(109,74,255,0.15)', 'rgba(109,74,255,0)', 'transparent']}
          style={styles.glowGradient}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, logoWrapStyle]}>
        {/* Subtle breathing effect using Moti (runs alongside Reanimated) */}
        <MotiView
          from={{ scale: 1 }}
          animate={{ scale: 1.02 }}
          transition={{
            type:       'timing',
            duration:   1200,
            loop:       true,
            repeatReverse: true,
          }}
        >
          <Image
            source={require('../assets/images/splash-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            fadeDuration={0}   // disable RN's own fade — we control it
          />
        </MotiView>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BG,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          9999,
  },
  glowRing: {
    position:     'absolute',
    width:        LOGO_SIZE * 2.5,
    height:       LOGO_SIZE * 2.5,
    borderRadius: LOGO_SIZE * 1.25,
    overflow:     'hidden',
  },
  glowGradient: {
    flex: 1,
  },
  logoWrap: {
    alignItems:  'center',
    justifyContent: 'center',
  },
  logo: {
    width:  LOGO_SIZE,
    height: LOGO_SIZE,
  },
});

export default React.memo(AnimatedSplash);