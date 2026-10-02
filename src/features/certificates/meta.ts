import type { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';

import type { CertificateType } from './api';

export const certificateTypeMeta: Record<
  CertificateType,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  INSPECTION: { label: 'Inspection', icon: 'clipboard-outline' },
  INSURANCE: { label: 'Insurance', icon: 'shield-checkmark-outline' },
  ELECTRIC: { label: 'Electric', icon: 'flash-outline' },
  HYGIENE: { label: 'Hygiene', icon: 'sparkles-outline' },
};

export const certificateStatusMeta = {
  ACTIVE: { label: 'Active', color: Colors.light.success },
  EXPIRING_SOON: { label: 'Expiring soon', color: Colors.light.warning },
  EXPIRED: { label: 'Expired', color: Colors.light.error },
} as const;
