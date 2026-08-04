import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

import type { BundlePrompt } from '../hooks/use-smart-add';

interface BundleOfferSheetProps {
  prompt: BundlePrompt | null;
  claiming: boolean;
  onAddBundle: () => void;
  onAddSingle: () => void;
  onClose: () => void;
}

/**
 * Shown when a scanned/searched product belongs to an active bundle offer.
 * The user chooses between adding the complete bundle or just the product.
 */
export function BundleOfferSheet({
  prompt,
  claiming,
  onAddBundle,
  onAddSingle,
  onClose,
}: BundleOfferSheetProps) {
  if (!prompt) return <BottomSheet visible={false} onClose={onClose}>{null}</BottomSheet>;

  const { check, offer } = prompt;

  // Savings are only exactly computable when a free item is the same product
  // (we know its price). Otherwise the offer message describes the deal.
  const estimatedSavings = offer.freeItems.reduce(
    (sum, item) => (item.productId === check.productId ? sum + item.freeQuantity * check.price : sum),
    0,
  );

  return (
    <BottomSheet visible={!!prompt} onClose={onClose}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="gift" size={26} color={Colors.light.primary} />
        </View>
        <Text style={styles.title}>Bundle Offer Available</Text>
        {!!offer.name && <Text style={styles.subtitle}>{offer.name}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Buy</Text>
        <View style={styles.itemRow}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.light.success} />
          <Text style={styles.itemText} numberOfLines={2}>
            {offer.buyQuantityRequired} × {check.productName}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Get free</Text>
        {offer.freeItems.map((item) => (
          <View key={item.productId} style={styles.itemRow}>
            <Ionicons name="gift-outline" size={18} color={Colors.light.primary} />
            <Text style={styles.itemText} numberOfLines={2}>
              {item.freeQuantity} × {item.productName}{' '}
              <Text style={styles.freeTag}>FREE</Text>
            </Text>
          </View>
        ))}
      </View>

      {estimatedSavings > 0 ? (
        <View style={styles.savingsRow}>
          <Text style={styles.savingsLabel}>Estimated savings</Text>
          <Text style={styles.savingsValue}>£{estimatedSavings.toFixed(2)}</Text>
        </View>
      ) : (
        !!offer.offerMessage && <Text style={styles.offerMessage}>{offer.offerMessage}</Text>
      )}

      <View style={styles.actions}>
        <PrimaryButton title="Add Bundle" onPress={onAddBundle} loading={claiming} />
        <PrimaryButton
          title="Add Single Product"
          variant="ghost"
          onPress={onAddSingle}
          disabled={claiming}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: 4,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.h4,
    color: Colors.light.text,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  sectionLabel: {
    ...Typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: Colors.light.textLight,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  itemText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.text,
    flexShrink: 1,
  },
  freeTag: {
    color: Colors.light.success,
    fontWeight: '900',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.primaryLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  savingsLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  savingsValue: {
    ...Typography.h4,
    color: Colors.light.primary,
  },
  offerMessage: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  actions: {
    gap: Spacing.xs,
  },
});
