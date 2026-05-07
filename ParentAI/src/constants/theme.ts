import { COLORS, colors as nurtureColors } from '../theme/colors';
import { radius, shadows, spacing } from '../theme/spacing';
import { typeScale } from '../theme/typography';

const light = nurtureColors.light;

export const Colors = {
  primary: light.primary,
  primaryLight: light.surface,
  primaryDark: COLORS.primaryDark,
  primaryFaded: 'rgba(92, 122, 107, 0.10)',

  secondary: light.secondary,
  secondaryLight: COLORS.surfaceContainerHigh,
  secondaryDark: COLORS.accent,

  accent: light.accent,
  accentLight: COLORS.warningBg,
  accentDark: COLORS.accent,

  toneCalm: COLORS.success,
  toneSupportive: light.primary,
  toneNeutral: light.outline,
  toneFrustrated: light.warning,
  toneAngry: light.danger,
  toneHarsh: light.danger,

  background: light.background,
  backgroundLight: light.surface,
  backgroundCard: light.card,
  backgroundCardLight: light.surface,
  surface: light.surface,

  text: light.text,
  textSecondary: light.textSecondary,
  textMuted: light.muted,
  textOnPrimary: light.onPrimary,

  success: light.success,
  warning: light.warning,
  error: light.danger,
  info: light.accent,

  border: light.border,
  borderLight: light.surfaceHigh,

  gradientPrimary: [COLORS.primary, COLORS.primaryDark] as const,
  gradientAccent: [light.primary, light.secondary] as const,
  gradientDanger: [light.danger, COLORS.errorBg] as const,
  gradientDark: [light.background, light.surface] as const,
  gradientCard: [light.card, light.surface] as const,
};

export const Spacing = spacing;

export const BorderRadius = {
  sm: radius.sm,
  md: radius.md,
  lg: radius.xl,
  xl: radius.xxl,
  round: radius.full,
};

export const Typography = {
  h1: {
    fontSize: typeScale.h1.fontSize,
    fontWeight: typeScale.h1.fontWeight,
    letterSpacing: -0.4,
    lineHeight: typeScale.h1.lineHeight,
  },
  h2: {
    fontSize: typeScale.h2.fontSize,
    fontWeight: typeScale.h2.fontWeight,
    letterSpacing: -0.2,
    lineHeight: typeScale.h2.lineHeight,
  },
  h3: {
    fontSize: typeScale.subheading.fontSize,
    fontWeight: typeScale.subheading.fontWeight,
    lineHeight: typeScale.subheading.lineHeight,
  },
  body: typeScale.body,
  bodySmall: typeScale.bodySmall,
  caption: typeScale.caption,
  button: {
    ...typeScale.button,
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
};

export const Shadows = {
  small: shadows.card,
  medium: shadows.card,
  large: shadows.overlay,
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
};
