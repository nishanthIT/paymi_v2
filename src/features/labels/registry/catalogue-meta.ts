/**
 * Catalogue row presentation (R08–R12): icon + pastel tile per template category.
 * Colours sampled from the references; icon shapes follow the spec's categories.
 */
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export type IconTone = 'red' | 'amber' | 'orange' | 'lavender' | 'teal' | 'beige' | 'purple' | 'dark';

export const TONES: Record<IconTone, { bg: string; fg: string }> = {
  red: { bg: '#FDE7E5', fg: '#F2463A' },
  amber: { bg: '#FFF3D1', fg: '#F2B019' },
  orange: { bg: '#FDEAE2', fg: '#F2703E' },
  lavender: { bg: '#E7E8FB', fg: '#5A5FD6' },
  teal: { bg: '#DDF3EF', fg: '#1E9E8B' },
  beige: { bg: '#EEE6E1', fg: '#6B4A3A' },
  purple: { bg: '#ECE4FB', fg: '#6C45D6' },
  dark: { bg: '#E6E6E8', fg: '#111111' },
};

const WOW = { icon: 'lightning-bolt' as IconName, tone: 'red' as IconTone };
const WAS_NOW = { icon: 'arrow-collapse-horizontal' as IconName, tone: 'orange' as IconTone };
const MULTI_BUY = { icon: 'glass-cocktail' as IconName, tone: 'amber' as IconTone };
const OFFER_TAG = { icon: 'tag' as IconName, tone: 'red' as IconTone };

export const TEMPLATE_ICONS: Record<string, { icon: IconName; tone: IconTone }> = {
  T01: WOW,
  T02: OFFER_TAG,
  T03: { icon: 'timer-outline', tone: 'amber' },
  T04: { icon: 'glass-cocktail', tone: 'red' },
  T05: WOW,
  T06: WAS_NOW,
  T07: MULTI_BUY,
  T08: { icon: 'card-text-outline', tone: 'red' },
  T09: WOW,
  T10: WAS_NOW,
  T11: MULTI_BUY,
  T12: OFFER_TAG,
  T13: WOW,
  T14: WAS_NOW,
  T15: MULTI_BUY,
  T16: { icon: 'record-circle-outline', tone: 'red' },
  T17: WOW,
  T18: WAS_NOW,
  T19: MULTI_BUY,
  T20: { icon: 'bullhorn', tone: 'red' },
  T21: { icon: 'view-sequential-outline', tone: 'lavender' },
  T22: { icon: 'view-column-outline', tone: 'teal' },
  T23: { icon: 'view-split-horizontal', tone: 'beige' },
  T24: { icon: 'rectangle-outline', tone: 'red' },
  T25: { icon: 'view-column-outline', tone: 'purple' },
  T26: { icon: 'view-column-outline', tone: 'teal' },
  T27: { icon: 'trophy', tone: 'red' },
  T28: { icon: 'format-title', tone: 'red' },
  T29: { icon: 'tag', tone: 'dark' },
};

/** Which optional text fields each design actually prints. */
export const TEMPLATE_FIELDS: Record<string, { headline?: string; list?: boolean; photo?: boolean }> = {
  T01: { headline: 'WOW', photo: true },
  T02: { headline: 'WOW', photo: true },
  T03: { headline: 'WOW', photo: true },
  T04: {},
  T05: { headline: 'WOW' },
  T06: {},
  T07: { headline: 'OFFER', list: true },
  T08: { headline: 'WOW' },
  T09: { photo: true },
  T10: {},
  T11: { headline: 'OFFER', list: true, photo: true },
  T12: { headline: 'WOW' },
  T13: { photo: true },
  T14: {},
  T15: { headline: 'OFFER', list: true },
  T16: { headline: 'OFFER' },
  T17: {},
  T18: {},
  T19: { headline: 'OFFER', list: true },
  T20: { headline: 'WOW', photo: true },
  T21: { photo: true },
  T22: { headline: 'WOW', photo: true },
  T23: { photo: true },
  T24: { headline: 'WOW', photo: true },
  T25: { headline: 'WOW', photo: true },
  T26: { headline: 'WOW', photo: true },
  T27: { headline: 'WOW', photo: true },
  T28: { headline: 'WOW', photo: true },
  T29: { headline: 'WOW', photo: true },
};

/** Market for regional filtering. No per-shop market setting exists yet; GB is the reference state. */
export const APP_MARKET = 'GB';
