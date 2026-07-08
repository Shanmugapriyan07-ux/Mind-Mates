import { useState, useEffect, useCallback } from 'react';
import { Dimensions } from 'react-native';
import { getDeviceTier, DeviceTier } from '../theme/breakPoints';
export interface ResponsiveState {
  screenWidth:  number;
  screenHeight: number;
  isSmallPhone:  boolean;
  isMediumPhone: boolean;
  isLargePhone:  boolean;
  isFoldable:    boolean;
  isTablet:      boolean;
  tier:          DeviceTier;
  isPortrait:  boolean;
  isLandscape: boolean;
  wp: (percent: number) => number;   
  hp: (percent: number) => number; 
  clampW: (min: number, preferred: number, max: number) => number;
  bubbleMaxWidth: number;
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
      bubbleMaxWidth:
        tier === 'tablet' || tier === 'foldable'
          ? width * 0.6
          : width * 0.72,
      contentMaxWidth:
        tier === 'tablet'   ? 680 :
        tier === 'foldable' ? 560 :
        width,
    };
  }, []);
  const [state, setState] = useState(getDimensions);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => {
      setState(getDimensions());
    });
    return () => sub.remove();
  }, [getDimensions]);
  return state;
}