import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const SCREEN = {
  width,
  height,
};

// Device tier thresholds (dp)
export const BREAKPOINTS = {
  smallPhone:  360,   // Older/budget Android, iPhone SE
  mediumPhone: 390,   // iPhone 14, Pixel 7, most mid-range
  largePhone:  430,   // iPhone Pro Max, Samsung Ultra
  foldable:    600,   // Foldable inner screen
  tablet:      768,   // Tablets
} as const;

export type DeviceTier =
  | 'smallPhone'
  | 'mediumPhone'
  | 'largePhone'
  | 'foldable'
  | 'tablet';

export function getDeviceTier(w = width): DeviceTier {
  if (w >= BREAKPOINTS.tablet)   return 'tablet';
  if (w >= BREAKPOINTS.foldable) return 'foldable';
  if (w >= BREAKPOINTS.largePhone) return 'largePhone';
  if (w >= BREAKPOINTS.mediumPhone) return 'mediumPhone';
  return 'smallPhone';
}