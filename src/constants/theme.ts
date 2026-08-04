/**
 * Warm, business-friendly theme for shopkeeper workflows.
 * Light mode is the primary experience; dark mode is optional.
 */

import { Platform } from 'react-native';

// Warm retail palette (light default)
const warmGold = '#B88A3B';
const warmGoldPressed = '#9E7633';
const warmNeutral = '#EDE2CF';
const warmAccent = '#D6B06A';
const warmBackground = '#F7F3EC';
const warmSurface = '#FFFFFF';
const warmSurfaceAlt = '#FBF8F2';
const warmBorder = '#DDD2BF';
const warmBorderStrong = '#C8B89D';
const warmText = '#2F2A22';
const warmTextSecondary = '#5D5548';
const warmTextMuted = '#837B6D';

// Semantic status colors
const success = '#2E7D32';
const error = '#B9382A';
const warning = '#C7771A';

export const Colors = {
  light: {
    // Text colors
    text: warmText,
    textSecondary: warmTextSecondary,
    textLight: warmTextMuted,
    
    // Background colors
    background: warmBackground,
    backgroundSecondary: warmSurfaceAlt,
    backgroundCard: warmSurface,
    
    // Brand colors
    primary: warmGold,
    primaryLight: warmNeutral,
    accent: warmAccent,
    secondary: warmNeutral,
    
    // UI colors
    tint: warmGold,
    icon: warmTextSecondary,
    tabIconDefault: warmTextMuted,
    tabIconSelected: warmGold,
    
    // Status colors
    success,
    error,
    warning,
    info: warmAccent,
    
    // Border and divider
    border: warmBorder,
    divider: warmNeutral,
    
    // Shadow
    shadow: 'rgba(47, 42, 34, 0.08)',

    // Utility tones
    surfaceAlt: warmSurfaceAlt,
    borderStrong: warmBorderStrong,
    glass: 'rgba(255, 255, 255, 0.85)',
    glassBorder: warmBorder,

    // Button system
    buttonPrimary: warmGold,
    buttonPrimaryPressed: warmGoldPressed,
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: warmNeutral,
    buttonSecondaryPressed: '#E3D5BE',
    buttonSecondaryText: warmText,
    buttonDisabled: '#D9CCB6',
    buttonDisabledText: '#9C927F',
  },
  dark: {
    // Compatibility palette for legacy screens still using Colors.dark directly
    text: warmText,
    textSecondary: warmTextSecondary,
    textLight: warmTextMuted,
    
    // Background colors (kept light for readability in shop environments)
    background: warmBackground,
    backgroundSecondary: warmSurfaceAlt,
    backgroundCard: warmSurface,
    
    // Brand colors
    primary: warmGold,
    primaryLight: warmNeutral,
    accent: warmAccent,
    secondary: warmNeutral,
    
    // UI colors
    tint: warmGold,
    icon: warmTextSecondary,
    tabIconDefault: warmTextMuted,
    tabIconSelected: warmGold,
    
    // Status colors
    success,
    error,
    warning,
    info: warmAccent,
    
    // Border and divider
    border: warmBorder,
    divider: warmNeutral,
    
    // Shadow
    shadow: 'rgba(47, 42, 34, 0.08)',
    
    // Utility tones
    surfaceAlt: warmSurfaceAlt,
    borderStrong: warmBorderStrong,
    glass: 'rgba(255, 255, 255, 0.85)',
    glassBorder: warmBorder,

    // Button system
    buttonPrimary: warmGold,
    buttonPrimaryPressed: warmGoldPressed,
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: warmNeutral,
    buttonSecondaryPressed: '#E3D5BE',
    buttonSecondaryText: warmText,
    buttonDisabled: '#D9CCB6',
    buttonDisabledText: '#9C927F',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Modern Typography Scale
export const Typography = {
  // Headers
  h1: {
    fontSize: 36,
    fontWeight: '800' as const,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
  },
  
  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  
  // Labels and captions
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  
  // Special text
  price: {
    fontSize: 20,
    fontWeight: '800' as const,
    lineHeight: 28,
  },
  savings: {
    fontSize: 14,
    fontWeight: '700' as const,
    lineHeight: 20,
  },
  
  // Modern styles
  neon: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 24,
    textShadowColor: 'rgba(0, 255, 136, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
};

// Modern Spacing Scale
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Modern Border Radius
export const BorderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

// Modern Shadow Effects
export const Shadows = {
  sm: {
    shadowColor: '#2F2A22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#2F2A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#2F2A22',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  neon: {
    shadowColor: warmGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 0,
  },
  glow: {
    shadowColor: warmAccent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 0,
  },
};

// Glassmorphism Effects
export const Glassmorphism = {
  light: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: warmBorder,
    backdropFilter: 'blur(10px)',
  },
  dark: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(212, 200, 181, 0.18)',
    backdropFilter: 'blur(10px)',
  },
};

// Modern Gradients
export const Gradients = {
  primary: ['#C79A4B', '#B88A3B'],
  secondary: ['#F2E6D4', '#E9D8BE'],
  dark: ['#2E2923', '#231F1A'],
  glass: ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.75)'],
};
