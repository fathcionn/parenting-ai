import { COLORS } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const shadows = {
  card: {
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  overlay: {
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 34,
    elevation: 8,
  },
};
