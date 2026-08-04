import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BorderRadius, Colors, Typography } from '@/constants/theme';

interface SizeBadgeProps {
  /** Formatted size label, e.g. "1 × 330ml" (see utils/pack-size.ts). Renders nothing when null. */
  label: string | null | undefined;
  style?: StyleProp<ViewStyle>;
}

/** Small consistent size badge shown beside product names across the app. */
export function SizeBadge({ label, style }: SizeBadgeProps) {
  if (!label) return null;
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  text: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.2,
  },
});
