import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight, LinearTransition } from 'react-native-reanimated';

import { ProgressBar } from '@/components/ui/progress-bar';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

export interface ShopSummary {
  shopId: string;
  shopName: string;
  total: number;
  collected: number;
}

interface ShopSelectorProps {
  shops: ShopSummary[];
  selectedShopId: string | null;
  onSelect: (shopId: string | null) => void;
  overallTotal: number;
  overallCollected: number;
}

/**
 * Horizontal shop switcher for Collect Mode. Each chip shows how many items
 * remain at that shop plus a mini progress bar.
 */
export const ShopSelector = memo(function ShopSelector({
  shops,
  selectedShopId,
  onSelect,
  overallTotal,
  overallCollected,
}: ShopSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <ShopChip
        label="All shops"
        remaining={overallTotal - overallCollected}
        progress={overallTotal > 0 ? overallCollected / overallTotal : 0}
        selected={selectedShopId === null}
        onPress={() => onSelect(null)}
      />
      {shops.map((shop, index) => (
        <Animated.View
          key={shop.shopId}
          entering={FadeInRight.duration(300).delay(index * 40)}
          layout={LinearTransition.springify().damping(24)}
        >
          <ShopChip
            label={shop.shopName}
            remaining={shop.total - shop.collected}
            progress={shop.total > 0 ? shop.collected / shop.total : 0}
            selected={selectedShopId === shop.shopId}
            onPress={() => onSelect(shop.shopId)}
          />
        </Animated.View>
      ))}
    </ScrollView>
  );
});

function ShopChip({
  label,
  remaining,
  progress,
  selected,
  onPress,
}: {
  label: string;
  remaining: number;
  progress: number;
  selected: boolean;
  onPress: () => void;
}) {
  const done = remaining === 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
    >
      <View style={styles.chipTop}>
        <Text
          style={[styles.chipLabel, selected && styles.chipLabelSelected]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <View style={[styles.countPill, selected && styles.countPillSelected, done && styles.countPillDone]}>
          <Text style={[styles.countText, (selected || done) && styles.countTextSelected]}>
            {done ? '✓' : `${remaining} left`}
          </Text>
        </View>
      </View>
      <ProgressBar
        progress={progress}
        height={4}
        color={selected ? '#FFFFFF' : Colors.light.primary}
        trackColor={selected ? 'rgba(255,255,255,0.3)' : Colors.light.backgroundSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  chip: {
    minWidth: 132,
    maxWidth: 200,
    gap: Spacing.xs + 2,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  chipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  chipLabel: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.light.text,
    flexShrink: 1,
  },
  chipLabelSelected: {
    color: '#FFFFFF',
  },
  countPill: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countPillSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  countPillDone: {
    backgroundColor: Colors.light.success,
  },
  countText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  countTextSelected: {
    color: '#FFFFFF',
  },
});
