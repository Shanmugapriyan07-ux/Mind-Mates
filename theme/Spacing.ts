import { SCREEN, getDeviceTier } from '../theme/breakPoints';

const tier = getDeviceTier(SCREEN.width);

// Base unit scales with device size
const BASE: Record<typeof tier, number> = {
  smallPhone:  14,
  mediumPhone: 16,
  largePhone:  18,
  foldable:    20,
  tablet:      22,
};
const base = BASE[tier];
export const SPACING = {
  xxs:  base * 0.25,   //  3–5
  xs:   base * 0.5,    //  7–11
  sm:   base * 0.75,   // 10–16
  md:   base * 1,      // 14–22  (base unit)
  lg:   base * 1.5,    // 21–33
  xl:   base * 2,      // 28–44
  xxl:  base * 3,      // 42–66
  xxxl: base * 4,      // 56–88
} as const;
export const SCREEN_PADDING_H = SPACING.md + SPACING.xs;
export const AVATAR = {
  xs:  base * 2,      // 28–44
  sm:  base * 2.5,    // 35–55
  md:  base * 3.5,    // 49–77
  lg:  base * 5,      // 70–110
  xl:  base * 7,      // 98–154
  xxl: base * 9,      // 126–198
} as const;

// Touch target — minimum 48dp per Material/HIG guidelines
export const TOUCH_TARGET = Math.max(48, base * 3);

// Icon sizes
export const ICON = {
  sm: base * 1.25,
  md: base * 1.5,
  lg: base * 2,
  xl: base * 2.5,
} as const;