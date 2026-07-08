import React, { useCallback, useRef } from 'react';
import { FlatListProps, InteractionManager } from 'react-native';
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
export const useDeferredAction = () => {
  const taskRef = useRef<any>(null);

  return useCallback((action: () => void) => {
    if (taskRef.current) taskRef.current.cancel();
    taskRef.current = InteractionManager.runAfterInteractions(action);
  }, []);
};
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
export const IMAGE_CACHE_PROPS = {
  cachePolicy:  'memory-disk' as const,
  transition:   { duration: 200 },
  priority:     'normal' as const,
};

export const IMAGE_CACHE_PROPS_HIGH = {
  ...IMAGE_CACHE_PROPS,
  priority: 'high' as const,
  transition: { duration: 100 },  
};
export const EMPTY_ARRAY: any[] = [];
export const EMPTY_OBJECT: Record<string, never> = {};
export const keyById  = (item: { id: string }) => item.id;
export const keyByConnectionId = (item: { connection_id: string }) => item.connection_id;

export const logStartupMilestone = () => {
  if (!__DEV__) return;
};
