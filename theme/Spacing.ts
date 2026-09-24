import { SCREEN, getDeviceTier } from '../theme/breakPoints';

const tier = getDeviceTier(SCREEN.width);

const BASE: Record<typeof tier, number> = {
  smallPhone:  14,
  mediumPhone: 16,
  largePhone:  18,
  foldable:    20,
  tablet:      22,
};
const base = BASE[tier];
export const SPACING = {
  xxs:  base * 0.25, 
  xs:   base * 0.5,  
  sm:   base * 0.75, 
  md:   base * 1,   
  lg:   base * 1.5,  
  xl:   base * 2,  
  xxl:  base * 3,     
  xxxl: base * 4,     
} as const;
export const SCREEN_PADDING_H = SPACING.md + SPACING.xs;
export const AVATAR = {
  xs:  base * 2,
  sm:  base * 2.5,    
  md:  base * 3.5,
  lg:  base * 5,      
  xl:  base * 7,
  xxl: base * 9, 
} as const;

export const TOUCH_TARGET = Math.max(48, base * 3);

export const ICON = {
  sm: base * 1.25,
  md: base * 1.5,
  lg: base * 2,
  xl: base * 2.5,
} as const;