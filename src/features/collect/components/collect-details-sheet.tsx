import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import type { ListProduct } from '@/features/lists/types';
import { useShopPrice } from '@/features/price-reports/hooks';
import { formatSizeLabel } from '@/utils/pack-size';
import { getProductImageUrl } from '@/utils/product-image';

interface CollectDetailsSheetProps {
  product: ListProduct | null;
  isLoading?: boolean;
  onClose: () => void;
}

function money(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `£${Number(value).toFixed(2)}`;
}

/** Full product details for a Collect Mode item, including live shop price. */
export function CollectDetailsSheet({ product, isLoading, onClose }: CollectDetailsSheetProps) {
  const { data: livePrice } = useShopPrice(
    product?.productId ?? null,
    product?.shopId ?? null,
  );

  if (!product) return <BottomSheet visible={false} onClose={onClose}>{null}</BottomSheet>;

  const imageUrl = getProductImageUrl(product.img as any, product.barcode);
  const aisle = product.aielNumber || product.locationCode;
  const lastUpdated = livePrice?.lastUpdated
    ? new Date(livePrice.lastUpdated).toLocaleDateString()
    : null;

  return (
    <BottomSheet visible={!!product} onClose={onClose}>
      <ScrollView bounces={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.imageWrap}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" />
            ) : (
              <Ionicons name="cube-outline" size={40} color={Colors.light.textLight} />
            )}
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.name}>{product.productName}</Text>
            {!!product.category && <Text style={styles.category}>{product.category}</Text>}
          </View>
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceMain}>
            <Text style={styles.priceLabel}>Price at {product.shopName || 'shop'}</Text>
            <View style={styles.priceValueRow}>
              <Text style={styles.priceValue}>{money(livePrice?.price ?? product.lowestPrice)}</Text>
              {(livePrice?.hasActiveOffer ?? product.hasActiveOffer) && (
                <>
                  <Text style={styles.priceOriginal}>
                    {money(livePrice?.originalPrice ?? product.originalPrice)}
                  </Text>
                  <View style={styles.offerPill}>
                    <Text style={styles.offerText}>OFFER</Text>
                  </View>
                </>
              )}
            </View>
            {!!lastUpdated && (
              <Text style={styles.priceUpdated}>Price last updated {lastUpdated}</Text>
            )}
          </View>
        </View>

        <View style={styles.grid}>
          <DetailRow
            icon="cube-outline"
            label="Pack size"
            value={
              formatSizeLabel({
                title: product.productName,
                packetSize: product.packetSize,
                retailSize: product.retailSize,
              }) || '—'
            }
          />
          <DetailRow icon="barcode-outline" label="Barcode" value={product.barcode || '—'} />
          {!product.caseBarcode && isLoading ? (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="barcode-outline" size={16} color={Colors.light.primary} />
              </View>
              <Text style={styles.detailLabel}>Case barcode</Text>
              <ActivityIndicator size="small" color={Colors.light.primary} />
            </View>
          ) : (
            <DetailRow icon="barcode-outline" label="Case barcode" value={product.caseBarcode || '—'} />
          )}
          <DetailRow icon="storefront-outline" label="Shop" value={product.shopName || '—'} />
          <DetailRow icon="location-outline" label="Aisle / shelf" value={aisle ? `Aisle ${aisle}` : 'Not mapped'} />
          <DetailRow icon="layers-outline" label="Quantity to collect" value={`${product.quantity}`} />
          <DetailRow
            icon="checkmark-done-outline"
            label="Status"
            value={product.isPurchased ? 'Collected' : 'To collect'}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={16} color={Colors.light.primary} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  imageWrap: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 74,
    height: 74,
  },
  heroInfo: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  category: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  priceCard: {
    backgroundColor: Colors.light.primaryLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  priceMain: {
    gap: 4,
  },
  priceLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  priceValue: {
    ...Typography.price,
    color: Colors.light.primary,
  },
  priceOriginal: {
    ...Typography.body,
    color: Colors.light.textLight,
    textDecorationLine: 'line-through',
  },
  offerPill: {
    backgroundColor: Colors.light.success,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  offerText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  priceUpdated: {
    ...Typography.caption,
    color: Colors.light.textLight,
  },
  grid: {
    gap: 2,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: Spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  detailValue: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.light.text,
    maxWidth: '55%',
  },
});
