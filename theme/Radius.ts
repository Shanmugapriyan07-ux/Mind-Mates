import { SCREEN, getDeviceTier } from '../theme/breakPoints';

const tier = getDeviceTier(SCREEN.width);

const BASE_RADIUS: Record<typeof tier, number> = {
  smallPhone:  10,
  mediumPhone: 12,
  largePhone:  14,
  foldable:    16,
  tablet:      18,
};

const base = BASE_RADIUS[tier];

export const RADIUS = {
  xs:     base * 0.33,   // ~4
  sm:     base * 0.5,    // ~6
  md:     base,          // ~12  (default card radius)
  lg:     base * 1.5,    // ~18
  xl:     base * 2,      // ~24
  xxl:    base * 2.5,    // ~30
  full:   9999,          // pill / circle
} as const;