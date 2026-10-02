/**
 * Labels feature design tokens, derived from the app theme (constants/theme.ts)
 * so the module shares PayMi's warm cream canvas, gold accent and brown text.
 * Print-artwork colours (promo red/yellow) are separate: they are what gets printed.
 */
import { Colors } from '@/constants/theme';

const C = Colors.light;

export const LabelTokens = {
  // Surfaces
  bg: C.background,
  surface: C.backgroundCard,
  surfaceAlt: C.backgroundSecondary,
  thumbTile: '#F3ECE0',
  previewBg: '#EEE6D8',
  pressed: '#F8F2E7',

  // Brand accent (links, selection, primary actions)
  accent: C.primary,
  accentPressed: C.buttonPrimaryPressed,
  accentSoft: '#F5ECDC',
  accentBorder: C.accent,
  chipSelected: '#F1E6D2',

  // Text
  text: C.text,
  textSecondary: C.textSecondary,
  textLight: C.textLight,

  // Lines
  border: C.border,
  borderStrong: C.borderStrong,
  divider: C.divider,
  labelOutline: '#CDBFA6',

  // Status (UI only)
  error: C.error,
  errorSoft: '#F8E7E3',
  success: C.success,

  // Print artwork — three distinct promo treatments, do not collapse (spec §2)
  ink: '#131316',
  promoRed: '#F44236',
  promoLabelYellow: '#F6DA3B',
  offerYellowBright: '#FFD60A',

  // Buttons
  buttonDark: C.text,

  // Geometry (logical units at a 390-wide comparison canvas)
  insetPage: 15,
  insetList: 12,
  radiusCard: 14,
  radiusThumb: 10,
  radiusButton: 26,

  // Type scale starting points (spec §2)
  fontTitle: 20,
  fontCardTitle: 16,
  fontBody: 14,
  fontDetail: 12,
} as const;
