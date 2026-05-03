
// components/SkeletonLoader.tsx
//
// ══════════════════════════════════════════════════════════════════
// INSTAGRAM-STYLE SHIMMER SKELETON
// ══════════════════════════════════════════════════════════════════
//
// DESIGN: Horizontal shimmer light sweeping left-to-right,
// identical to Instagram's story loading skeleton.
//
// PERFORMANCE:
//   - Shimmer is a single Animated.Value shared by ALL skeleton boxes
//   - One animation loop drives the entire skeleton — not one per box
//   - useNativeDriver=true → runs on UI thread, never drops frames
//   - React.memo on all components — zero re-renders on parent updates
//
// USAGE:
//   <ChatListSkeleton />          → full chat list placeholder
//   <ProfileSkeleton />           → profile screen placeholder
//   <SkeletonBox w={200} h={16} /> → custom inline box

import React, { useEffect, useRef } from 'react';
import {
  View, StyleSheet, Animated, Dimensions,
} from 'react-native';

const { width: SW } = Dimensions.get('window');

const SHIMMER_COLOR_BASE = '#E9EAEC';
const SHIMMER_COLOR_HIGH = '#F5F5F5';
const SHIMMER_DURATION   = 1100; // ms per sweep

// ── Shared shimmer value — one animation for all boxes ────────────
// Created at module level so all SkeletonBox instances share it.
// This prevents N simultaneous Animated.loops running in parallel.
const shimmerAnim = new Animated.Value(0);
let shimmerStarted = false;

const startShimmer = () => {
  if (shimmerStarted) return;
  shimmerStarted = true;
  Animated.loop(
    Animated.timing(shimmerAnim, {
      toValue:         1,
      duration:        SHIMMER_DURATION,
      useNativeDriver: true,
    })
  ).start();
};

// ── SkeletonBox ───────────────────────────────────────────────────
interface SkeletonBoxProps {
  w:            number | string;
  h:            number;
  radius?:      number;
  style?:       any;
}

export const SkeletonBox = React.memo(({ w, h, radius = 6, style }: SkeletonBoxProps) => {
  useEffect(() => { startShimmer(); }, []);

  // Shimmer translates a highlight from -SW to +SW
  const translateX = shimmerAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [-SW, SW],
  });

  return (
    <View style={[
      {
        width:           w as any,
        height:          h,
        borderRadius:    radius,
        backgroundColor: SHIMMER_COLOR_BASE,
        overflow:        'hidden',
      },
      style,
    ]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: SHIMMER_COLOR_HIGH,
            opacity:         0.7,
            transform:       [{ translateX }],
          },
        ]}
      />
    </View>
  );
});

// ── Chat Row Skeleton ─────────────────────────────────────────────
// Matches the layout of a SwipeableRow chat item
const ChatRowSkeleton = React.memo(({ opacity = 1 }: { opacity?: number }) => (
  <View style={[sk.chatRow, { opacity }]}>
    {/* Avatar circle */}
    <SkeletonBox w={52} h={52} radius={10} />
    {/* Text lines */}
    <View style={sk.chatText}>
      <SkeletonBox w="45%" h={13} radius={6} style={{ marginBottom: 8 }} />
      <SkeletonBox w="70%" h={11} radius={5} />
    </View>
    {/* Timestamp + badge area */}
    <View style={sk.chatMeta}>
      <SkeletonBox w={32} h={10} radius={4} style={{ marginBottom: 8 }} />
      <SkeletonBox w={20} h={20} radius={10} />
    </View>
  </View>
));

// ── Full Chat List Skeleton ───────────────────────────────────────
export const ChatListSkeleton = React.memo(() => (
  <View style={sk.listWrap}>
    <ChatRowSkeleton opacity={1.0} />
    <ChatRowSkeleton opacity={0.85} />
    <ChatRowSkeleton opacity={0.70} />
    <ChatRowSkeleton opacity={0.55} />
    <ChatRowSkeleton opacity={0.40} />
    <ChatRowSkeleton opacity={0.25} />
  </View>
));

// ── Profile Skeleton ──────────────────────────────────────────────
export const ProfileSkeleton = React.memo(() => (
  <View style={sk.profileWrap}>
    {/* Avatar */}
    <View style={{ alignItems: 'center', marginBottom: 16 }}>
      <SkeletonBox w={110} h={110} radius={55} style={{ marginBottom: 12 }} />
      <SkeletonBox w={160} h={20} radius={8} style={{ marginBottom: 8 }} />
      <SkeletonBox w={120} h={14} radius={6} style={{ marginBottom: 6 }} />
      <SkeletonBox w={90}  h={12} radius={5} />
    </View>
    {/* Stats row */}
    <View style={sk.statsRow}>
      <SkeletonBox w={70} h={44} radius={10} />
      <SkeletonBox w={70} h={44} radius={10} />
      <SkeletonBox w={70} h={44} radius={10} />
    </View>
    {/* Skill pills */}
    <View style={sk.pillsRow}>
      <SkeletonBox w={80}  h={34} radius={17} />
      <SkeletonBox w={100} h={34} radius={17} />
      <SkeletonBox w={75}  h={34} radius={17} />
    </View>
    {/* Skills card */}
    <View style={sk.skillsCard}>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        <SkeletonBox w={90} h={90} radius={14} style={{ flex: 1 }} />
        <SkeletonBox w={90} h={90} radius={14} style={{ flex: 1 }} />
        <SkeletonBox w={90} h={90} radius={14} style={{ flex: 1 }} />
      </View>
      <SkeletonBox w="100%" h={13} radius={5} style={{ marginBottom: 8 }} />
      <SkeletonBox w="75%"  h={13} radius={5} />
    </View>
  </View>
));

// ── Message Skeleton ──────────────────────────────────────────────
// Shown when chat screen first opens
export const MessageListSkeleton = React.memo(() => (
  <View style={{ padding: 12, gap: 16 }}>
    {/* Other user's message */}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <SkeletonBox w={32} h={32} radius={16} />
      <SkeletonBox w="55%" h={44} radius={16} />
    </View>
    {/* My message (right-aligned) */}
    <View style={{ alignItems: 'flex-end' }}>
      <SkeletonBox w="65%" h={36} radius={16} />
    </View>
    {/* Other user — multi-line */}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <SkeletonBox w={32} h={32} radius={16} />
      <View style={{ gap: 6 }}>
        <SkeletonBox w={200} h={36} radius={16} />
        <SkeletonBox w={140} h={36} radius={16} />
      </View>
    </View>
    {/* My message */}
    <View style={{ alignItems: 'flex-end', gap: 6 }}>
      <SkeletonBox w="45%" h={36} radius={16} />
    </View>
    <View style={{ alignItems: 'flex-end' }}>
      <SkeletonBox w="70%" h={120} radius={14} />
    </View>
  </View>
));

// ── Styles ────────────────────────────────────────────────────────
const sk = StyleSheet.create({
  chatRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 15,
    paddingVertical:   10,
    gap:            12,
    minHeight:      72,
  },
  chatText: {
    flex: 1,
    gap:  0,
  },
  chatMeta: {
    alignItems: 'flex-end',
    gap:        4,
  },
  listWrap: {
    paddingTop: 8,
  },
  profileWrap: {
    padding:    20,
    paddingTop: 24,
  },
  statsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            24,
    marginBottom:   20,
  },
  pillsRow: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  20,
    paddingHorizontal: 4,
  },
  skillsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius:    20,
    padding:         18,
  },
});
