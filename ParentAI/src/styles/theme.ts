import { COLORS, colors } from '../theme/colors';
import { radius, shadows, spacing } from '../theme/spacing';
import { typeScale } from '../theme/typography';

const light = colors.light;

export const theme = {
  colors: {
    background: light.background,
    surface: light.surface,
    text: light.text,
    textSecondary: light.textSecondary,
    textMuted: light.muted,
    border: light.border,

    primary: light.primary,
    primaryLight: light.surface,
    secondary: light.card,

    success: light.success,
    successBg: COLORS.successBg,
    successText: COLORS.successText,
    warning: light.warning,
    error: light.danger,
    info: light.accent,

    calm: COLORS.success,
    aggressive: COLORS.error,
    supportive: COLORS.primary,
    neutral: COLORS.textFaint,
  },

  spacing,

  borderRadius: {
    sm: radius.sm,
    md: radius.md,
    lg: radius.xl,
    xl: radius.xxl,
  },

  typography: {
    h1: typeScale.h1,
    h2: typeScale.h2,
    h3: typeScale.subheading,
    body: typeScale.body,
    bodySmall: typeScale.bodySmall,
    label: typeScale.caption,
  },

  shadows: {
    sm: shadows.card,
    md: shadows.card,
    lg: shadows.overlay,
  },
};

export type Theme = typeof theme;
