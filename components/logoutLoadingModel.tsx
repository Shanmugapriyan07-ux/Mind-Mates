import { s } from '@/utils/scale';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type ShowFn = (message?: string) => void;
type HideFn = () => void;

let _show: ShowFn = () => {};
let _hide: HideFn = () => {};

export function showLogoutLoader(message = 'Signing out…') { _show(message); }
export function hideLogoutLoader()                          { _hide();        }

/**
 * Wait for the modal to actually paint before continuing.
 * Two rAF passes: first schedules a paint, second confirms it committed.
 * This is the same technique React Native's own InteractionManager uses.
 */
export function waitForModalPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function SpinnerRing({ active }: { active: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;
  const animRef  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      rotation.setValue(0);
      animRef.current = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1, duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
      animRef.current = null;
    }
    return () => { animRef.current?.stop(); };
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
  const [visible, setVisible]   = useState(false);
  const [message, setMessage]   = useState('Signing out…');
  const [spinning, setSpinning] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeRef  = useRef<Animated.CompositeAnimation | null>(null);

  const show: ShowFn = useCallback((msg = 'Signing out…') => {
    setMessage(msg);
    setVisible(true);
    setSpinning(true);
    fadeRef.current?.stop();
    fadeAnim.setValue(0);
    fadeRef.current = Animated.timing(fadeAnim, {
      toValue: 1, duration: 160,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    fadeRef.current.start();
  }, [fadeAnim]);

  const hide: HideFn = useCallback(() => {
    fadeRef.current?.stop();
    fadeRef.current = Animated.timing(fadeAnim, {
      toValue: 0, duration: 260,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    });
    fadeRef.current.start(() => {
      setVisible(false);
      setSpinning(false);
      fadeAnim.setValue(0);
    });
  }, [fadeAnim]);

  useEffect(() => {
    _show = show;
    _hide = hide;
    return () => { _show = () => {}; _hide = () => {}; };
  }, [show, hide]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <View style={styles.card}>
          <SpinnerRing active={spinning} />
         
        </View>
      </Animated.View>
    </Modal>
  );
}


const PURPLE = '#6D4AFF';
const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: '#ffffff',
    alignItems:      'center',
    justifyContent:  'center',
  },
  card: {
    alignItems: 'center',
    gap:        s(18),
  },
  brandMark: {
    width:           s(44),
    height:          s(44),
    borderRadius:   s(22),
    backgroundColor: '#EDE9FF',
    alignItems:      'center',
    justifyContent:  'center',
  },
  ring: {
    width:          s(35),
    height:         s(35),
    borderRadius:   s(20),
    borderWidth:    s(3.5),
    borderColor:    '#EDE9FF',
    borderTopColor: PURPLE,
  },
});