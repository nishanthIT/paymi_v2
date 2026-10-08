import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';

import type { ShoppingList } from '../types';

interface ListCardProps {
  list: ShoppingList;
  onPress: () => void;
  onDelete: () => void;
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return 'Updated today';
  if (diffDays === 1) return 'Updated yesterday';
  if (diffDays < 7) return `Updated ${diffDays} days ago`;
  return `Updated ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

/** Premium list card: gold monogram, item count, last-updated, quiet delete. */
export function ListCard({ list, onPress, onDelete }: ListCardProps) {
  const isPending = list.id.startsWith('optimistic-');

  return (
    <Pressable
      onPress={onPress}
      disabled={isPending}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, isPending && styles.cardPending]}
    >
      <View style={styles.monogram}>
        <Text style={styles.monogramText}>{list.name.trim().charAt(0).toUpperCase() || 'L'}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {list.name}
        </Text>
        {list.copiedFromName ? (
          <View style={styles.sharedRow}>
            <Ionicons name="sync-outline" size={12} color={Colors.light.textLight} />
            <Text style={styles.sharedText} numberOfLines={1}>
              Copied from {list.copiedFromName} · live
            </Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <View style={styles.countPill}>
            <Ionicons name="basket-outline" size={12} color={Colors.light.primary} />
            <Text style={styles.countText}>
              {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <Text style={styles.updated}>{formatUpdated(list.updatedAt)}</Text>
        </View>
      </View>
      <Pressable
        onPress={onDelete}
        disabled={isPending}
        hitSlop={10}
        style={({ pressed }) => [styles.deleteButton, pressed && styles.deletePressed]}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.light.textLight} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  cardPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
    transform: [{ scale: 0.99 }],
  },
  cardPending: {
    opacity: 0.6,
  },
  monogram: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    ...Typography.h4,
    color: Colors.light.primary,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  name: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  sharedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sharedText: {
    ...Typography.caption,
    color: Colors.light.textLight,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: {
    ...Typography.caption,
    color: Colors.light.primary,
    fontWeight: '700',
  },
  updated: {
    ...Typography.caption,
    color: Colors.light.textLight,
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
});
