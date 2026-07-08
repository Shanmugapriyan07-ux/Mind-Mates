import { Dimensions, PixelRatio, StyleSheet } from 'react-native';
const { width: W, height: H } = Dimensions.get('window');
type Tier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'tablet';
function getTier(w: number): Tier {
  if (w >= 600) return 'tablet';
  if (w >= 430) return 'xl';
  if (w >= 414) return 'lg';
  if (w >= 390) return 'md';
  if (w >= 360) return 'sm';   
  return 'xs';
}
export const DEVICE_TIER = getTier(W);
const BASE_W: Record<Tier, number> = {
  xs:     340,  
  sm:     360,  
  md:     390,  
  lg:     414,  
  xl:     430, 
  tablet: 600,  
};
const BASE_H: Record<Tier, number> = {
  xs:     700,
  sm:     800, 
  md:     844,
  lg:     896,
  xl:     932,
  tablet: 1024,
};
const BW = BASE_W[DEVICE_TIER];
const BH = BASE_H[DEVICE_TIER];
export const s = (size: number): number => {
  const scaled = size * (W / BW);
  return Math.round(
    Math.min(size * 1.30, Math.max(size * 0.80, scaled))
  );
};
export const vs = (size: number): number => {
  const scaled = size * (H / BH);
  return Math.round(
    Math.min(size * 1.25, Math.max(size * 0.80, scaled))
  );
};
export const ms = (size: number, factor = 0.35): number => {
  const widthScaled = size + (s(size) - size) * factor;
  const fontScale   = PixelRatio.getFontScale();
  const normalized  = fontScale > 1.0 ? widthScaled / fontScale : widthScaled;
  return Math.round(
    Math.max(10, Math.min(size * 1.18, normalized))
  );
};
export const SCREEN_WIDTH  = W;
export const SCREEN_HEIGHT = H;
export const isCompact = DEVICE_TIER === 'xs' || DEVICE_TIER === 'sm';
export const isLarge = DEVICE_TIER === 'xl' || DEVICE_TIER === 'tablet';
export const hairline = StyleSheet.hairlineWidth;