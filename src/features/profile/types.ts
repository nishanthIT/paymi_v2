import type { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';

import type { ShopFeature } from '@/features/employees/permissions';

export type ProfileToolSection = 'daily' | 'records' | 'business';

export interface ShopTool {
  route: Href;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  section: ProfileToolSection;
  ownerOnly?: boolean;
  /** Shop permission an employee needs to see this tool. */
  feature?: ShopFeature;
  badge?: number;
  badgeColor?: string;
}
