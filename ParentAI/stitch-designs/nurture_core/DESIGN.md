---
name: Nurture Core
colors:
  surface: '#fcf8ff'
  surface-dim: '#dbd8e4'
  surface-bright: '#fcf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2fe'
  surface-container: '#efecf8'
  surface-container-high: '#e9e6f3'
  surface-container-highest: '#e4e1ed'
  on-surface: '#1b1b23'
  on-surface-variant: '#464554'
  inverse-surface: '#303038'
  inverse-on-surface: '#f2effb'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#6b38d4'
  on-secondary: '#ffffff'
  secondary-container: '#8455ef'
  on-secondary-container: '#fffbff'
  tertiary: '#904900'
  on-tertiary: '#ffffff'
  tertiary-container: '#b55d00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703700'
  background: '#fcf8ff'
  on-background: '#1b1b23'
  surface-variant: '#e4e1ed'
typography:
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  subheading:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
  button:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 24px
---

## Brand & Style

This design system is built on the pillars of empathy, clarity, and reliability. It targets parents seeking modern, AI-driven guidance without the clinical coldness of traditional software. The visual language balances professional expertise with a gentle, family-oriented touch.

The chosen style is **Modern/Corporate with a Warm approach**. It leverages soft, organic gradients and high-readability layouts to reduce cognitive load for busy parents. By combining precise typography with generous spacing and pill-shaped interactive elements, the system evokes a sense of calm and safety.

## Colors

The color strategy uses a base of soft indigo and violet to create a soothing, expert atmosphere. The "Soft Indigo" primary color provides a sense of stable intelligence, while "Violet" adds a touch of warmth and imagination. Cyan is reserved for secondary actions and accenting key AI-driven insights to ensure they stand out without feeling aggressive.

In light mode, the system prioritizes high-key backgrounds to feel airy and open. In dark mode, the palette shifts to a deep navy and slate to reduce eye strain during late-night parenting sessions, maintaining accessibility and depth through the use of tiered card elevations.

## Typography

This design system utilizes a dual-font approach. **Plus Jakarta Sans** is used for headings and brand moments; its soft, rounded terminals provide an approachable and modern personality. **Inter** is employed for body text and functional UI elements, ensuring maximum readability and a neutral, trustworthy tone for dense informational content.

The type scale is intentionally generous to accommodate different reading environments. Headlines use a bold weight to establish clear information hierarchy, while body text uses a 1.6x line height to prevent fatigue.

## Layout & Spacing

The system follows a **fluid grid model** with a base 4px rhythm. On mobile devices, a 2-column or single-stack layout is preferred, while tablets and desktops utilize a 12-column grid. 

Layouts should emphasize vertical rhythm and white space to create a "breathable" interface. Content groups are separated by `32px` (xl) to indicate a shift in topic, while internal card padding is strictly set to `16px` (md) or `24px` (lg) to maintain consistency.

## Elevation & Depth

Depth is conveyed through **Ambient Shadows** and **Tonal Layers**. Instead of harsh blacks, shadows utilize a soft indigo tint to integrate with the brand palette.

- **Surface 0 (Background):** Flat, used for the main canvas.
- **Surface 1 (Cards):** 16px radius with a subtle `0 2px 12px rgba(99, 102, 241, 0.08)` shadow.
- **Surface 2 (Overlays/Modals):** A more pronounced shadow to indicate higher z-index and temporary focus.

In Dark Mode, elevation is communicated through increasing the lightness of the card background (Surface 1 is lighter than Background) rather than relying on shadows, ensuring clarity in low-light environments.

## Shapes

The shape language is defined by a consistent **16px (1rem)** corner radius for all container elements, creating a friendly and safe aesthetic. Interactive components like buttons and tags use a "full" roundedness (pill-shaped) to distinguish them from content containers. This distinction helps users instinctively identify "touchable" targets versus "readable" information.

## Components

### Buttons
- **Primary:** Full-pill shape with a linear gradient from `#6366f1` to `#8b5cf6` (top-left to bottom-right). Text is white with a slight drop shadow for legibility.
- **Secondary:** Transparent background with an indigo border or a soft indigo tint.
- **States:** Hover states should include a subtle 5% increase in brightness.

### Cards
- Standard containers use a 16px border radius and a `#ffffff` background (light mode). 
- Cards include a soft border (`1px solid #e2e8f0`) in addition to the shadow for extra definition on high-resolution screens.

### Chips & Tags
- Pill-shaped with a low-opacity background of their respective category color.
- **Bedtime:** Purple background with dark purple text.
- **Homework:** Blue background with dark blue text.
- **Health:** Green background with dark green text.

### Input Fields
- Subtle grey background (`#f1f5f9`) with no initial border. Upon focus, the field transitions to a white background with a 2px indigo border and a soft glow.

### AI Suggestions (Coach Insights)
- A specialized card component using the Cyan accent color as a left-hand accent border to signify that the content was generated or curated by the AI coach.