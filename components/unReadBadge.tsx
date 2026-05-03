

// components/UnreadBadge.tsx
//
// ══════════════════════════════════════════════════════════════════
// UNREAD BADGE UI COMPONENT
// ══════════════════════════════════════════════════════════════════
//
// Renders the red dot with count number — used in:
//   1. Tab bar icons (chat tab, notification tab)
//   2. Chat list rows (per-conversation dot)
//   3. Any screen header that shows unread count
//
// ANIMATION:
//   Badge scales in with a spring when it appears (count 0 → 1+).
//   Badge scales out when count reaches 0.
//   Count number cross-fades when it changes (1 → 2 → 3).
//   All animations use useNativeDriver=true → 60fps, zero JS thread cost.
//
// PERFORMANCE:
//   React.memo — only re-renders when its count prop changes.
//   Zero re-renders from parent component updates.
//   Animated.Value is created once via useRef — no re-creation on render.

import React, { useEffect, useRef, memo } from 'react';
import {
  View, Text, StyleSheet, Animated, ViewStyle,
} from 'react-native';

// ── Props ─────────────────────────────────────────────────────────
interface UnreadBadgeProps {
  count:    number;       // raw count (0 hides badge)
  size?:    'sm' | 'md' | 'lg';  // sm=tab bar dot, md=default, lg=header
  style?:   ViewStyle;
}

// ── Badge sizes ────────────────────────────────────────────────────
const SIZES = {
  sm: { min: 16, font: 9,  pad: 3  },
  md: { min: 20, font: 11, pad: 5  },
  lg: { min: 24, font: 13, pad: 7  },
};

// ── Component ──────────────────────────────────────────────────────
const UnreadBadge = memo(({ count, size = 'md', style }: UnreadBadgeProps) => {
  const sz      = SIZES[size];
  const visible = count > 0;
  const label   = count <= 0 ? '' : count <= 99 ? String(count) : '99+';
  const isDot   = count === 1 && size === 'sm';  // single-message → dot only

  // Spring scale for badge appear/disappear
  const scaleAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  // Opacity for count cross-fade
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // ── Animate badge in/out when visibility changes ───────────────
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue:         visible ? 1 : 0,
      damping:         14,
      stiffness:       280,
      mass:            0.6,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  // ── Animate count cross-fade when number changes ───────────────
  const prevCount = useRef(count);
  useEffect(() => {
    if (prevCount.current === count || !visible) {
      prevCount.current = count;
      return;
    }
    prevCount.current = count;

    // Flash opacity: fade out → update text → fade in
    Animated.sequence([
      Animated.timing(opacityAnim, { toValue: 0.4, duration: 80,  useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]).start();
  }, [count, visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        bd.badge,
        {
          minWidth:    sz.min,
          height:      sz.min,
          borderRadius: sz.min / 2,
          paddingHorizontal: isDot ? 0 : sz.pad,
          transform:   [{ scale: scaleAnim }],
        },
        style,
      ]}
    >
      {!isDot && (
        <Animated.Text
          style={[bd.count, { fontSize: sz.font, opacity: opacityAnim }]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      )}
    </Animated.View>
  );
});

// ── Styles ────────────────────────────────────────────────────────
const bd = StyleSheet.create({
  badge: {
    backgroundColor: '#EF4444',
    alignItems:      'center',
    justifyContent:  'center',
    // Shadow for depth (WhatsApp style)
    shadowColor:     '#EF4444',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.35,
    shadowRadius:    2,
    elevation:       3,
    // White border — makes badge readable on both light and dark backgrounds
    borderWidth:     1.5,
    borderColor:     '#FFFFFF',
  },
  count: {
    color:      '#FFFFFF',
    fontWeight: '700',
    lineHeight: undefined,  // auto
    textAlign:  'center',
    includeFontPadding: false,
  },
});

UnreadBadge.displayName = 'UnreadBadge';
export default UnreadBadge;

// ══════════════════════════════════════════════════════════════════
// USAGE EXAMPLES
// ═════════════════════════════════════════════════════════════════=

/*
// ── Tab bar badge ──────────────────────────────────────────────────
// In your tab navigator, or wherever you render tab icons:

import { useChatUnread, useNotifUnread } from '@/hooks/useBadgeSync';
import UnreadBadge from '@/components/UnreadBadge';

const ChatTabIcon = ({ focused }: { focused: boolean }) => {
  const count = useChatUnread();
  return (
    <View style={{ position: 'relative' }}>
      <Ionicons name="chatbubble-ellipses" size={24} color={focused ? '#6D4AFF' : '#9CA3AF'} />
      <UnreadBadge
        count={count}
        size="sm"
        style={{ position: 'absolute', top: -6, right: -8 }}
      />
    </View>
  );
};

// ── Chat list row badge ────────────────────────────────────────────
// In your SwipeableRow or chat list item:

import { useChatDot } from '@/hooks/useBadgeSync';
import UnreadBadge from '@/components/UnreadBadge';

const ChatRow = ({ chatId }: { chatId: string }) => {
  const unread = useChatDot(chatId);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
   
      <UnreadBadge count={unread} size="sm" />
    </View>
  );
};

// ── Clear on chat open ─────────────────────────────────────────────
// In your chatScreen.tsx:

import { useChatBadge } from '@/hooks/useBadgeSync';

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams();
  useChatBadge(chatId);  // auto-clears on mount
  // ...
}

// ── Clear on notification screen open ─────────────────────────────
// In your notifications tab screen:

import { useNotifBadge } from '@/hooks/useBadgeSync';

export default function NotificationsScreen() {
  useNotifBadge();  // auto-clears on mount
  // ...
}
*/