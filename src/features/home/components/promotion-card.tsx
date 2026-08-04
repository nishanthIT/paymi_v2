import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primary-button';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';

import type { Promotion } from '../types';

interface PromotionCardProps {
  promotion: Promotion;
  onPressImage: (uri: string) => void;
  onViewProducts: (promotion: Promotion) => void;
}

function expiryInfo(endDate: string | null): { label: string; urgent: boolean } | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return null;
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Expired', urgent: true };
  if (days === 0) return { label: 'Ends today', urgent: true };
  if (days === 1) return { label: 'Ends tomorrow', urgent: true };
  if (days <= 7) return { label: `Ends in ${days} days`, urgent: false };
  return {
    label: `Until ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
    urgent: false,
  };
}

/** Promotion card: hero image (tap to zoom), details and View Products CTA. */
export function PromotionCard({ promotion, onPressImage, onViewProducts }: PromotionCardProps) {
  const expiry = expiryInfo(promotion.endDate);
  const productCount = promotion.products.length;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onPressImage(promotion.imageUrl)}
        style={({ pressed }) => [styles.imageWrap, pressed && { opacity: 0.92 }]}
      >
        <Image
          source={{ uri: promotion.imageUrl }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={promotion.id}
          transition={220}
        />
        {expiry && (
          <View style={[styles.expiryPill, expiry.urgent && styles.expiryPillUrgent]}>
            <Ionicons name="time-outline" size={11} color="#FFFFFF" />
            <Text style={styles.expiryText}>{expiry.label}</Text>
          </View>
        )}
        <View style={styles.zoomHint}>
          <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
        </View>
      </Pressable>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {promotion.title}
        </Text>
        {!!promotion.description && (
          <Text style={styles.description} numberOfLines={2}>
            {promotion.description}
          </Text>
        )}
        <View style={styles.metaRow}>
          {!!promotion.shop?.name && (
            <View style={styles.metaItem}>
              <Ionicons name="storefront-outline" size={13} color={Colors.light.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>
                {promotion.shop.name}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="cube-outline" size={13} color={Colors.light.textSecondary} />
            <Text style={styles.metaText}>
              {productCount} {productCount === 1 ? 'product' : 'products'}
            </Text>
          </View>
        </View>

        <PrimaryButton
          title="View Products"
          onPress={() => onViewProducts(promotion)}
          disabled={productCount === 0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    ...Shadows.md,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  expiryPill: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(26, 20, 8, 0.72)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  expiryPillUrgent: {
    backgroundColor: Colors.light.error,
  },
  expiryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  zoomHint: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(26, 20, 8, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  description: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '60%',
  },
  metaText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
});
