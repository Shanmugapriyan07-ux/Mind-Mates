import { Dimensions } from 'react-native';
const { width, height } = Dimensions.get('window');
export const SCREEN = {
  width,
  height,
};
export const BREAKPOINTS = {
  smallPhone:  360,   
  mediumPhone: 390,   
  largePhone:  430,   
  foldable:    600,   
  tablet:      768,   
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