import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { SizeBadge } from '@/components/ui/size-badge';
import { formatSizeLabel } from '@/utils/pack-size';
import { getProductImageUrl } from '@/utils/product-image';

import type { Product } from '../types';

interface SearchResultCardProps {
  product: Product;
  onPress: () => void;
  onAdd: () => void;
  /** Spinner only on this card's add button — never blocks the rest of the UI. */
  isAdding: boolean;
  /** Product already in the target list → adding bumps quantity. */
  inList: boolean;
}

/** Search result card with image, availability, price and a quick-add button. */
export const SearchResultCard = React.memo(function SearchResultCard({
  product,
  onPress,
  onAdd,
  isAdding,
  inList,
}: SearchResultCardProps) {
  const imageUrl = getProductImageUrl(product.img as any, product.barcode);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.imageWrapper}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" transition={150} />
        ) : (
          <Ionicons name="cube-outline" size={24} color={Colors.light.textLight} />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {product.title}
          </Text>
          <SizeBadge label={formatSizeLabel(product)} />
        </View>
        {!!product.barcode && (
          <Text style={styles.barcode} numberOfLines={1}>
            {product.barcode}
          </Text>
        )}
        <View style={styles.metaRow}>
          {product.lowestPrice != null && (
            <Text style={styles.price}>from £{Number(product.lowestPrice).toFixed(2)}</Text>
          )}
          {product.availableInShops != null && (
            <Text style={styles.shops}>
              {product.availableInShops} {product.availableInShops === 1 ? 'shop' : 'shops'}
            </Text>
          )}
        </View>
      </View>

      <Pressable
        onPress={onAdd}
        disabled={isAdding}
        hitSlop={8}
        style={({ pressed }) => [
          styles.addButton,
          inList && styles.addButtonInList,
          pressed && styles.addButtonPressed,
        ]}
      >
        {isAdding ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name={inList ? 'add-circle' : 'add'} size={22} color="#FFFFFF" />
        )}
      </Pressable>
    </Pressable>
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
  cardPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
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
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.text,
    flexShrink: 1,
  },
  barcode: {
    ...Typography.caption,
    color: Colors.light.textLight,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  price: {
    ...Typography.caption,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  shops: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  addButtonInList: {
    backgroundColor: Colors.light.success,
  },
  addButtonPressed: {
    opacity: 0.85,
  },
});
