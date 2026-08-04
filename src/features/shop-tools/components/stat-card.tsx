import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'error' | 'warning';
  style?: ViewStyle;
}

const toneColor = {
  default: Colors.light.text,
  success: Colors.light.success,
  error: Colors.light.error,
  warning: Colors.light.warning,
} as const;

/** Small dashboard stat card (e.g. "Total Loss £42.50"). */
export function StatCard({ label, value, tone = 'default', style }: StatCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: toneColor[tone] }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/** Row of pulsing skeleton cards shown while loading a list. */
export function ListSkeleton({ rows = 4, height = 76 }: { rows?: number; height?: number }) {
  return (
    <View style={styles.skeletonWrap}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={height} radius={BorderRadius.lg} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    gap: 4,
    ...Shadows.sm,
  },
  label: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    ...Typography.h4,
  },
  skeletonWrap: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
});
