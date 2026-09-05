import { selPhase, useAuthStore } from '@/stores/authStore';
import { s } from '@/utils/scale';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
export function showLogoutLoader(_message?: string) {}
export function hideLogoutLoader() {}
export function waitForModalPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
function SpinnerRing({ active }: { active: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;
  const loopRef  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      rotation.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1, duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
    }
    return () => { loopRef.current?.stop(); };
  }, [active, rotation]);

  const spin = rotation.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.ring, { transform: [{ rotate: spin }] }]} />
  );
}

export function LogoutLoadingModal() {
  const phase    = useAuthStore(selPhase);
  const isActive = phase === 'logging_out' || phase === 'deleting';

  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const animRef      = useRef<Animated.CompositeAnimation | null>(null);
  const everActive   = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isActive) {
      everActive.current = true;
      setMounted(true);
      fadeAnim.setValue(1); 
    } else if (everActive.current) {
      animRef.current?.stop();
      animRef.current = Animated.timing(fadeAnim, {
        toValue: 0, duration: 350,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      });
      animRef.current.start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [isActive, fadeAnim]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[styles.backdrop, { opacity: fadeAnim }]}
      pointerEvents="auto"
    >
      <View style={styles.card}>
        <SpinnerRing active={isActive} />
      </View>
    </Animated.View>
  );
}


LogoutLoadingModal.whyDidYouRender = true;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex:          99999,
    elevation:       99999,
    backgroundColor: '#6D4AFF',
    alignItems:      'center',
    justifyContent:  'center',
  },
  card: {
    alignItems: 'center',
  },
  ring: {
    width:          s(38),
    height:         s(38),
    borderRadius:   s(22),
    borderWidth:    s(3.5),
    borderColor:    'rgba(255,255,255,0.25)',
    borderTopColor: '#ffffff',
  },
});