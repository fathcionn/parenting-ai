// ParentAI Design System
// Minimalist Black & White palette for a calm, professional, and elegant UI

export const Colors = {
  // Primary - Deep Black
  primary: '#000000',
  primaryLight: '#333333',
  primaryDark: '#000000',
  primaryFaded: 'rgba(0, 0, 0, 0.05)',

  // Secondary - Elegant Gray
  secondary: '#757575',
  secondaryLight: '#BDBDBD',
  secondaryDark: '#424242',

  // Accent - Black
  accent: '#000000',
  accentLight: '#424242',
  accentDark: '#000000',

  // Tone Colors (Grayscale for minimalism)
  toneCalm: '#424242',
  toneSupportive: '#757575',
  toneNeutral: '#9E9E9E',
  toneFrustrated: '#616161',
  toneAngry: '#212121',
  toneHarsh: '#000000',

  // Backgrounds - Clean Whites and very light grays
  background: '#FFFFFF',
  backgroundLight: '#FAFAFA',
  backgroundCard: '#FFFFFF',
  backgroundCardLight: '#F5F5F5',
  surface: '#F5F5F5',

  // Text
  text: '#000000',
  textSecondary: '#616161',
  textMuted: '#9E9E9E',
  textOnPrimary: '#FFFFFF',

  // Status (Monochrome)
  success: '#000000',
  warning: '#757575',
  error: '#000000',
  info: '#424242',

  // Borders
  border: '#E0E0E0',
  borderLight: '#F5F5F5',

  // Gradients
  gradientPrimary: ['#000000', '#212121'] as const,
  gradientAccent: ['#212121', '#424242'] as const,
  gradientDanger: ['#424242', '#616161'] as const,
  gradientDark: ['#FAFAFA', '#F5F5F5'] as const,
  gradientCard: ['#FFFFFF', '#FAFAFA'] as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 4, // More modern, slightly sharper corners
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
};

export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  glow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
};
