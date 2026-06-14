import { PixelRatio } from 'react-native';
import { SCREEN, getDeviceTier } from '../theme/breakPoints';

const tier = getDeviceTier(SCREEN.width);

// Moderate scale factor — prevents oversized text on large screens
// while keeping it readable on small ones
const SCALE_FACTOR: Record<typeof tier, number> = {
  smallPhone:  0.92,
  mediumPhone: 1.0,
  largePhone:  1.05,
  foldable:    1.1,
  tablet:      1.18,
};

const scale = SCALE_FACTOR[tier];

/**
 * Scales a font size proportionally to screen density + device tier.
 * Caps at a max to prevent runaway sizes on tablets.
 */
export function scaleFont(size: number, maxSize?: number): number {
  const scaled = Math.round(size * scale);
  const normalized = scaled / PixelRatio.getFontScale();
  return maxSize ? Math.min(normalized, maxSize) : normalized;
}

// Typography scale — every font size in the app
export const TYPOGRAPHY = {
  // Size
  tiny:    scaleFont(10),
  small:   scaleFont(12),
  caption: scaleFont(13),
  body:    scaleFont(14),
  bodyMd:  scaleFont(15),
  bodyLg:  scaleFont(16),
  subhead: scaleFont(17),
  title:   scaleFont(18),
  titleLg: scaleFont(20),
  heading: scaleFont(22),
  display: scaleFont(26),
  hero:    scaleFont(30),

  // Weight shorthands (use with fontWeight style)
  weight: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
    heavy:    '800' as const,
  },

  // Line height multipliers
  lineHeight: {
    tight:   1.2,
    normal:  1.4,
    relaxed: 1.6,
  },
} as const;

// Convenience: get line height from font size
export function lineHeight(
  fontSize: number,
  variant: keyof typeof TYPOGRAPHY.lineHeight = 'normal'
): number {
  return Math.round(fontSize * TYPOGRAPHY.lineHeight[variant]);
}