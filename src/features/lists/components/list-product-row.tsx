import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { SizeBadge } from '@/components/ui/size-badge';
import { formatSizeLabel } from '@/utils/pack-size';
import { getProductImageUrl } from '@/utils/product-image';

import type { ListProduct } from '../types';
import { QuantityStepper } from './quantity-stepper';

interface ListProductRowProps {
  item: ListProduct;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

/** Product row inside a list: image, price, quantity, remove — collected status is only tracked in Collect Mode. */
export const ListProductRow = React.memo(function ListProductRow({
  item,
  onQuantityChange,
  onRemove,
}: ListProductRowProps) {
  const imageUrl = getProductImageUrl(item.img, item.barcode);
  const price = item.hasActiveOffer && item.offerPrice != null ? item.offerPrice : item.lowestPrice;
  const isPending = item.id.startsWith('optimistic-');

  return (
    <View style={[styles.card, isPending && styles.cardPending]}>
      <View style={styles.imageWrapper}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" transition={150} />
        ) : (
          <Ionicons name="cube-outline" size={22} color={Colors.light.textLight} />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={2}>
            {item.productName}
          </Text>
          <SizeBadge
            label={formatSizeLabel({
              title: item.productName,
              packetSize: item.packetSize,
              retailSize: item.retailSize,
            })}
          />
        </View>
        {(item.isFreeItem || item.bundlePromotionId) && (
          <View style={styles.badgeRow}>
            {item.isFreeItem ? (
              <View style={[styles.bundlePill, styles.freePill]}>
                <Ionicons name="gift" size={10} color="#FFFFFF" />
                <Text style={styles.bundlePillText}>FREE · Bundle</Text>
              </View>
            ) : (
              <View style={styles.bundlePill}>
                <Ionicons name="gift-outline" size={10} color={Colors.light.primary} />
                <Text style={[styles.bundlePillText, styles.bundlePillTextPrimary]}>
                  Bundle Offer{item.freeQuantity ? ` · +${item.freeQuantity} FREE` : ''}
                </Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.priceRow}>
          <Text style={styles.price}>£{price.toFixed(2)}</Text>
          {item.hasActiveOffer && item.offerPrice != null && (
            <Text style={styles.originalPrice}>£{item.originalPrice.toFixed(2)}</Text>
          )}
          {!!item.shopName && item.shopName !== 'Unknown Shop' && (
            <Text style={styles.shop} numberOfLines={1}>
              · {item.shopName}
            </Text>
          )}
        </View>
        <View style={styles.controls}>
          <QuantityStepper
            value={item.quantity}
            onChange={onQuantityChange}
            compact
          />
          <Pressable
            onPress={onRemove}
            disabled={isPending}
            hitSlop={10}
            style={({ pressed }) => [styles.removeButton, pressed && styles.removePressed]}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.light.textLight} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.sm,
    ...Shadows.sm,
  },
  cardPending: {
    opacity: 0.6,
  },
  imageWrapper: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.text,
    flexShrink: 1,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  bundlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  freePill: {
    backgroundColor: Colors.light.success,
    borderColor: Colors.light.success,
  },
  bundlePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bundlePillTextPrimary: {
    color: Colors.light.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    ...Typography.bodySmall,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  originalPrice: {
    ...Typography.caption,
    color: Colors.light.textLight,
    textDecorationLine: 'line-through',
  },
  shop: {
    ...Typography.caption,
    color: Colors.light.textLight,
    flexShrink: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
});
