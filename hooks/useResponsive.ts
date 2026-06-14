import { useState, useEffect, useCallback } from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import { BREAKPOINTS, getDeviceTier, DeviceTier } from '../theme/breakPoints';

export interface ResponsiveState {
  // Raw dimensions
  screenWidth:  number;
  screenHeight: number;

  // Device flags
  isSmallPhone:  boolean;
  isMediumPhone: boolean;
  isLargePhone:  boolean;
  isFoldable:    boolean;
  isTablet:      boolean;
  tier:          DeviceTier;

  // Orientation
  isPortrait:  boolean;
  isLandscape: boolean;

  // Helpers
  wp: (percent: number) => number;   // % of screen width
  hp: (percent: number) => number;   // % of screen height
  clampW: (min: number, preferred: number, max: number) => number;

  // Chat bubble max width
  bubbleMaxWidth: number;

  // Content max width (for tablets / foldables)
  contentMaxWidth: number;
}

export function useResponsive(): ResponsiveState {
  const getDimensions = useCallback(() => {
    const { width, height } = Dimensions.get('window');
    const tier = getDeviceTier(width);

    return {
      screenWidth:  width,
      screenHeight: height,
      isSmallPhone:  tier === 'smallPhone',
      isMediumPhone: tier === 'mediumPhone',
      isLargePhone:  tier === 'largePhone',
      isFoldable:    tier === 'foldable',
      isTablet:      tier === 'tablet',
      tier,
      isPortrait:  height >= width,
      isLandscape: width > height,
      wp:  (pct: number) => (width  * pct) / 100,
      hp:  (pct: number) => (height * pct) / 100,
      clampW: (min: number, preferred: number, max: number) =>
        Math.min(Math.max(preferred, min), max),
      // Chat bubbles: 72% on phones, 60% on tablets
      bubbleMaxWidth:
        tier === 'tablet' || tier === 'foldable'
          ? width * 0.6
          : width * 0.72,
      // Max content width — prevents over-stretching on tablets
      contentMaxWidth:
        tier === 'tablet'   ? 680 :
        tier === 'foldable' ? 560 :
        width,
    };
  }, []);

  const [state, setState] = useState(getDimensions);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }: { window: ScaledSize }) => {
      setState(getDimensions());
    });
    return () => sub.remove();
  }, [getDimensions]);

  return state;
}