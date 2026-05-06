export const colors = {
  primary: "#6D28D9",
  primaryDark: "#4C1D95",
  primaryLight: "#A78BFA",
  secondary: "#EC4899",
  background: "#FFFFFF",
  text: "#111827",
  textSecondary: "#4B5563",
  muted: "#6B7280",
  white: "#FFFFFF",
  black: "#000000",
  textLight: "#D1D5DB",
  warning: "#F97316",
  danger: "#EF4444",
  success: "#10B981",
  border: "#E5E7EB",
  gradient: {
    primary: ["#6D28D9", "#EC4899"],
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 32,
};

export const fontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
};

// default export to satisfy expo-router route-check (non-visual module)
export default {} as any;
