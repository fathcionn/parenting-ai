---
name: Nurture Core Dark
colors:
  surface: '#13131b'
  surface-dim: '#13131b'
  surface-bright: '#393841'
  surface-container-lowest: '#0d0d15'
  surface-container-low: '#1b1b23'
  surface-container: '#1f1f27'
  surface-container-high: '#292932'
  surface-container-highest: '#34343d'
  on-surface: '#e4e1ed'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e4e1ed'
  inverse-on-surface: '#303038'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#4cd7f6'
  on-tertiary: '#003640'
  tertiary-container: '#009eb9'
  on-tertiary-container: '#002f38'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#13131b'
  on-background: '#e4e1ed'
  surface-variant: '#34343d'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 0.5rem
  sm: 0.75rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
  gutter: 1.5rem
  margin-mobile: 1rem
  margin-desktop: 2rem
  max-width: 1280px
---

## Brand & Style

The design system focuses on a warm, family-oriented atmosphere within a modern dark-themed environment. The personality is protective, intelligent, and deeply trustworthy, designed to make users feel secure while navigating digital communication tools. 

The aesthetic style is **Corporate / Modern** with a slight **Glassmorphism** influence to add depth and warmth. By utilizing soft indigo and violet tones against a deep navy foundation, the UI avoids the coldness often associated with dark modes, instead offering a "night-light" comfort that is easy on the eyes for parents and educators.

## Colors

The palette transitions from a deep midnight foundation to vibrant, accessible accents. 

- **Primary & Secondary:** Indigo and Violet provide a regal yet approachable core.
- **Accent:** Cyan is used sparingly for high-interest calls to action or interactive highlights.
- **Status Colors:** Success, Warning, and Danger colors have been shifted to higher luminance values to ensure they maintain a 4.5:1 contrast ratio against the dark surfaces. 
- **Neutrals:** The background and surface colors utilize a slight blue tint to maintain harmony with the brand palette, preventing the UI from feeling "flat black."

## Typography

This design system pairs **Manrope** for headlines with **Be Vietnam Pro** for body text. 

- **Manrope** provides a balanced, modern geometric structure for titles, ensuring the brand feels professional and "SaaS-ready."
- **Be Vietnam Pro** is used for all functional text to inject warmth and approachability. Its slightly wider apertures and friendly terminals make long-form reading comfortable.
- Tracking is slightly increased for small labels in dark mode to prevent "ink bleed" visual effects on high-brightness screens.

## Layout & Spacing

The design system utilizes a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 

- **Rhythm:** An 8px linear scale is the standard, with a 4px sub-unit for tight interface elements like icons and labels.
- **Safe Areas:** Generous inner padding (lg/xl) is encouraged within cards to maintain the "airy" and friendly feel, even in a dark environment.
- **Consistency:** Use fixed gutters (1.5rem) to maintain vertical rhythm across disparate content sections.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Ambient Shadows**. 

1. **Base Layer:** Background (`#1a1a2e`).
2. **Surface Layer:** Cards and containers (`#16213e`) sit above the base.
3. **Interactive Layer:** Hover states use a subtle primary-tinted glow or a slightly lighter surface color (`#1e294b`).

**Shadows:** In this dark system, shadows are large and diffused, using a semi-transparent Indigo-black tint (`rgba(0, 0, 0, 0.4)`) to create a sense of physical lift rather than just a dark smudge. Border strokes (`#334155`) are essential for defining edges where tonal contrast is low.

## Shapes

The design system employs **Rounded** geometry (8px standard). 

- **Standard Elements:** Buttons, inputs, and small chips use a 0.5rem (8px) radius.
- **Large Elements:** Cards and modals use a 1rem (16px) radius to emphasize the friendly, nurturing nature of the brand.
- **Full Rounding:** Progress bars and specific "Pill" tags use a maximum radius for a soft, organic look.

## Components

- **Buttons:** Primary buttons use a gradient from Indigo to Violet with white text. Secondary buttons use a ghost style with a `#334155` border and Primary text.
- **Cards:** Defined by `#16213e` fill and a subtle `1px` border of `#334155`. Soft inner shadows are optional for "inset" feel.
- **Inputs:** Backgrounds should be slightly darker than the surface they sit on or match the background color (`#1a1a2e`). Active states utilize a Cyan (`#06b6d4`) glow.
- **Chips/Badges:** Use low-opacity backgrounds (e.g., Primary at 15% opacity) with high-contrast text for a sophisticated, accessible look.
- **Interactive Feedback:** Icons should use the Secondary or Accent colors to guide the eye toward actionable areas.
- **Nurture Specifics:** Provide "Progress Rings" for educational tracking, utilizing the Cyan accent to denote completion and the Violet for active milestones.