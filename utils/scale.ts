import { Dimensions, PixelRatio, StyleSheet } from 'react-native';
import { DeviceTier, getDeviceTier } from '../theme/breakPoints';

const { width: W, height: H } = Dimensions.get('window');

export const DEVICE_TIER: DeviceTier = getDeviceTier(W);
const BASE_W: Record<DeviceTier, number> = {
  smallPhone:  360,
  mediumPhone: 390,
  largePhone:  414,
  foldable:    600,
  tablet:      768,
};
const BASE_H: Record<DeviceTier, number> = {
  smallPhone:  740,
  mediumPhone: 844,
  largePhone:  896,
  foldable:    1024,
  tablet:      1024,
};

const BW = BASE_W[DEVICE_TIER];
const BH = BASE_H[DEVICE_TIER];

export const s = (size: number): number => {
  const scaled = size * (W / BW);
  return Math.round(Math.min(size * 1.30, Math.max(size * 0.80, scaled)));
};

export const vs = (size: number): number => {
  const scaled = size * (H / BH);
  return Math.round(Math.min(size * 1.25, Math.max(size * 0.80, scaled)));
};

export const ms = (size: number, factor = 0.35): number => {
  const widthScaled = size + (s(size) - size) * factor;
  const fontScale = PixelRatio.getFontScale();
  const normalized = fontScale > 1.0 ? widthScaled / fontScale : widthScaled;
  return Math.round(Math.max(10, Math.min(size * 1.18, normalized)));
};

export const SCREEN_WIDTH = W;
export const SCREEN_HEIGHT = H;
export const isCompact = DEVICE_TIER === 'smallPhone';
export const isLarge = DEVICE_TIER === 'largePhone' || DEVICE_TIER === 'tablet';
export const hairline = StyleSheet.hairlineWidth;