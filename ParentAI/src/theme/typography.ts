export const typography = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 32,
};

export const typeScale = {
  h1: {
    fontSize: typography.display,
    fontWeight: '700' as const,
    lineHeight: 38,
  },
  h2: {
    fontSize: typography.xxl,
    fontWeight: '700' as const,
    lineHeight: 31,
  },
  subheading: {
    fontSize: typography.xl,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: typography.base,
    fontWeight: '400' as const,
    lineHeight: 26,
  },
  bodySmall: {
    fontSize: typography.sm,
    fontWeight: '400' as const,
    lineHeight: 21,
  },
  caption: {
    fontSize: typography.xs,
    fontWeight: '500' as const,
    lineHeight: 17,
  },
  button: {
    fontSize: typography.base,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
};
