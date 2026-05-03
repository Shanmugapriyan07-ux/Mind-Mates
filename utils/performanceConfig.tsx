// utils/performanceConfig.tsx
//
// ══════════════════════════════════════════════════════════════════
// PERFORMANCE CONFIGURATION — Instagram-Level Optimizations
// ══════════════════════════════════════════════════════════════════
//
// This file exports reusable FlatList configs, image cache helpers,
// and lazy loading patterns used across the app.

import React, { useCallback, useRef } from 'react';
import { FlatListProps, InteractionManager } from 'react-native';

// ══════════════════════════════════════════════════════════════════
// FLATLIST PERFORMANCE CONFIGS
// ══════════════════════════════════════════════════════════════════
//
// WHY THESE SPECIFIC VALUES:
//
// initialNumToRender=8: Render only what fits a phone screen (~6-8 items).
//   More than this adds JS parse time before first paint.
//
// maxToRenderPerBatch=5: How many off-screen items render per JS frame.
//   Higher = smoother fast-scroll but more JS work per frame.
//   5 is the sweet spot for 60fps scroll.
//
// windowSize=5: The "virtual window" around the visible area.
//   windowSize=5 means 2 screens above + 2 screens below are rendered.
//   Lower = less memory. Higher = less blank flash on fast scroll.
//   5 matches Instagram's behavior.
//
// removeClippedSubviews=true: Removes native views that are off-screen.
//   Crucial on Android where RN keeps more native views in memory.
//   Known iOS bug: can cause blank items — test carefully on iOS.
//
// updateCellsBatchingPeriod=50: How often RN processes new items (ms).
//   50ms = 20 batches/second max. Lower = smoother, more CPU.

export const CHAT_LIST_FLATLIST_CONFIG: Partial<FlatListProps<any>> = {
  initialNumToRender:       8,
  maxToRenderPerBatch:      5,
  windowSize:               5,
  removeClippedSubviews:    true,
  updateCellsBatchingPeriod: 50,
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode:       'interactive',
  showsVerticalScrollIndicator: false,
};

export const MESSAGE_LIST_FLATLIST_CONFIG: Partial<FlatListProps<any>> = {
  initialNumToRender:       20,   // messages: show more since they're small
  maxToRenderPerBatch:      10,
  windowSize:               10,
  removeClippedSubviews:    true,
  updateCellsBatchingPeriod: 30,  // faster updates for real-time chat
  showsVerticalScrollIndicator: false,
  keyboardShouldPersistTaps: 'handled',
};

// ══════════════════════════════════════════════════════════════════
// DEFERRED ACTION HOOK
// ══════════════════════════════════════════════════════════════════
//
// Run expensive work AFTER the current interaction (gesture, animation) completes.
// Use this for: navigation callbacks, data fetching triggered by taps,
// heavy computation after scroll comes to rest.
//
// Instagram uses this pattern extensively — tap on chat → navigation
// runs after the tap animation finishes, never during.
//
// Usage:
//   const runAfterInteraction = useDeferredAction();
//   const handlePress = () => runAfterInteraction(() => router.push(...));

export const useDeferredAction = () => {
  const taskRef = useRef<any>(null);

  return useCallback((action: () => void) => {
    if (taskRef.current) taskRef.current.cancel();
    taskRef.current = InteractionManager.runAfterInteractions(action);
  }, []);
};

// ══════════════════════════════════════════════════════════════════
// LAZY SCREEN LOADER
// ══════════════════════════════════════════════════════════════════
//
// Wraps a heavy screen component with React.lazy + Suspense.
// The screen's JS bundle is only parsed when the screen is first visited.
// First visit: ~200ms parse delay (show skeleton).
// Second visit: instant (module is cached in memory).
//
// Usage:
//   const HeavyScreen = lazyScreen(() => import('./HeavyScreen'), <HeavySkeleton />);

export const lazyScreen = (
  factory: () => Promise<{ default: React.ComponentType<any> }>,
  fallback: React.ReactNode
) => {
  const LazyComponent = React.lazy(factory) as React.ComponentType<any>;
  return (props: any) => (
    <React.Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </React.Suspense>
  );
};

// ══════════════════════════════════════════════════════════════════
// IMAGE CACHE STRATEGY
// ══════════════════════════════════════════════════════════════════
//
// expo-image (not react-native Image) has built-in disk caching.
// Use these standard props on all expo-image instances for best performance.
//
// cachePolicy="memory-disk": Cache in RAM first, then disk.
//   RAM cache = instant re-render on navigation back
//   Disk cache = loads from disk on app restart (no network)
//
// transition={200}: Smooth 200ms fade-in from cache/network.
//   Prevents the harsh pop-in of uncached images.
//
// priority="normal": Use "high" for images above the fold (visible immediately).
//   "high" tells the image loader to skip the queue for this image.

export const IMAGE_CACHE_PROPS = {
  cachePolicy:  'memory-disk' as const,
  transition:   { duration: 200 },
  priority:     'normal' as const,
};

export const IMAGE_CACHE_PROPS_HIGH = {
  ...IMAGE_CACHE_PROPS,
  priority: 'high' as const,
  transition: { duration: 100 },  // faster for high-priority images
};

// ══════════════════════════════════════════════════════════════════
// MEMOIZATION HELPERS
// ══════════════════════════════════════════════════════════════════

// Stable empty array — use instead of [] in render to avoid re-renders
export const EMPTY_ARRAY: any[] = [];

// Stable empty object — use instead of {} in render
export const EMPTY_OBJECT: Record<string, never> = {};

// keyExtractor for FlatList — extracted to avoid inline arrow function recreation
// Usage: keyExtractor={keyById}
export const keyById  = (item: { id: string }) => item.id;
export const keyByConnectionId = (item: { connection_id: string }) => item.connection_id;

// ══════════════════════════════════════════════════════════════════
// STARTUP TIMING LOGGER
// ══════════════════════════════════════════════════════════════════
//
// Logs key startup milestones to console in development.
// Helps identify what's slow: is it fonts? data? navigation?
// Remove in production or guard with __DEV__.

const startTime = Date.now();

export const logStartupMilestone = (label: string) => {
  if (!__DEV__) return;
  const elapsed = Date.now() - startTime;
  console.log(`🚀 [Startup] ${label}: +${elapsed}ms`);
};

// Example output:
//   🚀 [Startup] JS bundle loaded: +0ms
//   🚀 [Startup] Root layout mounted: +42ms
//   🚀 [Startup] Fonts loaded: +187ms
//   🚀 [Startup] Session loaded: +203ms
//   🚀 [Startup] Splash hidden: +210ms
//   🚀 [Startup] Home screen mounted: +398ms
//   🚀 [Startup] Chat data loaded: +620ms