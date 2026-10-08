import type { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/contexts/AuthContext';

export type ShopFeature =
  | 'feature.lists'
  | 'feature.tasks'
  | 'feature.expiry'
  | 'feature.fridges'
  | 'feature.cleaning'
  | 'feature.incidents'
  | 'feature.age_records'
  | 'feature.waste'
  | 'feature.supplier_payouts'
  | 'feature.shift_sheet';

export type AccessLevel = 'read' | 'write' | 'edit';

/** Read is the bare feature key; write/edit are suffixed. Mirrors the backend. */
export type ShopPermission = ShopFeature | `${ShopFeature}.write` | `${ShopFeature}.edit`;

export interface FeatureOption {
  value: ShopFeature;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Mirrors SHOP_FEATURES in the backend; the API enforces these per request.
export const SHOP_FEATURE_OPTIONS: FeatureOption[] = [
  { value: 'feature.lists', label: 'Shopping lists', icon: 'list-outline' },
  { value: 'feature.tasks', label: 'Tasks', icon: 'checkbox-outline' },
  { value: 'feature.expiry', label: 'Manage expiry', icon: 'calendar-outline' },
  { value: 'feature.fridges', label: 'Temperature log', icon: 'thermometer-outline' },
  { value: 'feature.cleaning', label: 'Cleaning', icon: 'sparkles-outline' },
  { value: 'feature.incidents', label: 'Incident logs', icon: 'warning-outline' },
  { value: 'feature.age_records', label: 'Age restriction records', icon: 'shield-checkmark-outline' },
  { value: 'feature.waste', label: 'Waste log', icon: 'trash-outline' },
  { value: 'feature.supplier_payouts', label: 'Supplier payouts', icon: 'cash-outline' },
  { value: 'feature.shift_sheet', label: 'Shift sheet', icon: 'receipt-outline' },
];

export const ACCESS_LEVELS: { level: AccessLevel; label: string; hint: string }[] = [
  { level: 'read', label: 'Read', hint: 'See records' },
  { level: 'write', label: 'Write', hint: 'Add new records' },
  { level: 'edit', label: 'Edit', hint: 'Change or delete records' },
];

export const accessKey = (feature: ShopFeature, level: AccessLevel): ShopPermission =>
  level === 'read' ? feature : (`${feature}.${level}` as ShopPermission);

export const ALL_SHOP_PERMISSIONS: ShopPermission[] = SHOP_FEATURE_OPTIONS.flatMap((o) =>
  ACCESS_LEVELS.map((l) => accessKey(o.value, l.level)),
);

/** New employees get full access to every tool. */
export function defaultShopPermissions(): ShopPermission[] {
  return [...ALL_SHOP_PERMISSIONS];
}

/** Toggles one level; write/edit need read, so they switch it on, and switching read off clears them. */
export function setAccessLevel(
  permissions: string[],
  feature: ShopFeature,
  level: AccessLevel,
  on: boolean,
): string[] {
  const next = new Set(permissions);
  if (on) {
    next.add(accessKey(feature, level));
    next.add(feature);
  } else if (level === 'read') {
    ACCESS_LEVELS.forEach((l) => next.delete(accessKey(feature, l.level)));
  } else {
    next.delete(accessKey(feature, level));
  }
  return ALL_SHOP_PERMISSIONS.filter((p) => next.has(p));
}

export function featureLevels(permissions: string[], feature: ShopFeature): AccessLevel[] {
  if (!permissions.includes(feature)) return [];
  return ACCESS_LEVELS.map((l) => l.level).filter((level) => permissions.includes(accessKey(feature, level)));
}

/** "Read · Write · Edit", "Read only" or "No access". */
export function accessSummary(permissions: string[], feature: ShopFeature): string {
  const levels = featureLevels(permissions, feature);
  if (levels.length === 0) return 'No access';
  if (levels.length === 1) return 'Read only';
  return levels.map((level) => ACCESS_LEVELS.find((l) => l.level === level)!.label).join(' · ');
}

/** Owners always have every shop tool; employees only what their owner switched on (read access). */
export function useShopFeature(feature: ShopFeature | undefined): boolean {
  const { user } = useAuth();
  if (!feature || user?.userType !== 'EMPLOYEE') return true;
  return !!user.shopAccess?.permissions?.includes(feature);
}

export function useShopFeatures(): (feature: ShopFeature | undefined) => boolean {
  const { user } = useAuth();
  return (feature) =>
    !feature || user?.userType !== 'EMPLOYEE' || !!user.shopAccess?.permissions?.includes(feature);
}
