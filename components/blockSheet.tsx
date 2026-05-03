import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

// ─── Types ────────────────────────────────────────────────────────
interface MenuItem {
  icon:          string;
  label:         string;
  color?:        string;
  onPress:       () => void;
  dividerAfter?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  items:   MenuItem[];
}

// ─── Component ────────────────────────────────────────────────────
export const ChatMenuSheet = ({ visible, onClose, items }: Props) => {
  // ── Animation values ──────────────────────────────────────────
  // progress: 0 = closed, 1 = open
  // All animation properties derive from this single value
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Open: spring for scale (bouncy), timing for opacity (instant feel)
      progress.value = withSpring(1, {
        damping:   20,
        stiffness: 300,
        mass:      0.6,
      });
    } else {
      // Close: fast timing — closing should always feel snappy
      progress.value = withTiming(0, {
        duration: 150,
        easing:   Easing.out(Easing.cubic),
      });
    }
  }, [visible]);


  const CARD_WIDTH = 220;

  const animatedStyle = useAnimatedStyle(() => {
    const scale      = 0.85 + progress.value * 0.15; // 0.85 → 1.0
    const translateY = -8   + progress.value * 8;    // -8px → 0px
    // Correct for RN scaling from center → make it scale from right edge
    const translateX = (CARD_WIDTH / 2) * (1 - scale);

    return {
      opacity:   progress.value,
      transform: [
        { translateY },
        { translateX },
        { scale },
      ],
    };
  });

  // ── Backdrop animated style ───────────────────────────────────
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.3, // subtle dark backdrop (0 → 0.3)
  }));

  if (!visible && progress.value === 0) return null;

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* ── Backdrop — tap anywhere to close ───────────────────── */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]}
          pointerEvents="none"
        />
      </Pressable>

      {/* ── Dropdown card ──────────────────────────────────────── */}
      {/* TEACHING: Card anchored top-right (below header ≈ 56px)
          transformOrigin correction via translateX makes it grow
          from the top-right corner — exactly like WhatsApp ✅      */}
      <Animated.View
        style={[m.card, { width: CARD_WIDTH }, animatedStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {items.map((item, index) => (
          <View key={index}>
            <TouchableOpacity
              style={m.item}
              onPress={() => {
                onClose();
                // Small delay so menu closes before action fires
                setTimeout(item.onPress, 120);
              }}
              activeOpacity={0.65}
            >
              <Ionicons
                name={item.icon as any}
                size={19}
                color={item.color ?? '#555'}
              />
              <Text style={[m.label, item.color ? { color: item.color } : {}]}>
                {item.label}
              </Text>
            </TouchableOpacity>

            {/* Optional divider between groups of actions */}
            {item.dividerAfter && index < items.length - 1 && (
              <View style={m.divider} />
            )}
          </View>
        ))}
      </Animated.View>
    </Modal>
  );
};

export default ChatMenuSheet;

// ─── Styles ───────────────────────────────────────────────────────
const m = StyleSheet.create({
  // Card anchored to top-right corner
  // top: 52 = just below header (adjust if your header height differs)
  card: {
    position:        'absolute',
    top:             80,
    right:           32,
    backgroundColor: '#FFFFFF',
    borderRadius:    8,
    overflow:        'hidden',
    // Shadow
    shadowColor:     '#000',
    shadowOpacity:   0.08,
    shadowRadius:    12,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       20,
  },

  item: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    paddingHorizontal: 18,
    paddingVertical:   13,
  },

  label: {
    fontSize:   15,
    fontWeight: '400',
    color:      '#1a1a1a',
  },

  divider: {
    height:          StyleSheet.hairlineWidth,
    marginHorizontal: 0,
   
  },
});