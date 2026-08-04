import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import React, { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { SizeBadge } from '@/components/ui/size-badge';
import type { ListProduct } from '@/features/lists/types';
import { formatSizeLabel } from '@/utils/pack-size';
import { getProductImageUrl } from '@/utils/product-image';

interface CollectProductCardProps {
  product: ListProduct;
  onToggle: (product: ListProduct) => void;
  onOpenDetails: (product: ListProduct) => void;
  /** Resolves when the wrong-price report was accepted. */
  onSubmitPrice: (product: ListProduct, reportedPrice: number) => Promise<void>;
}

function formatPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return `£${Number(value).toFixed(2)}`;
}

/**
 * Premium Collect Mode card: animated check-off, aisle guidance and an
 * inline wrong-price reporter.
 */
export const CollectProductCard = memo(function CollectProductCard({
  product,
  onToggle,
  onOpenDetails,
  onSubmitPrice,
}: CollectProductCardProps) {
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceValue, setPriceValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reported, setReported] = useState(false);

  const checkScale = useSharedValue(1);
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.get() }],
  }));

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    checkScale.set(withSpring(1.25, { damping: 12, stiffness: 300 }, () => {
      'worklet';
      checkScale.set(withTiming(1, { duration: 120 }));
    }));
    onToggle(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onToggle, product]);

  const handleSubmitPrice = useCallback(async () => {
    const parsed = Number(priceValue.replace(',', '.'));
    if (!parsed || parsed <= 0) return;
    setSubmitting(true);
    try {
      await onSubmitPrice(product, parsed);
      setReported(true);
      setPriceOpen(false);
      setPriceValue('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setReported(false), 2600);
    } catch {
      // Errors surface via toast from the screen.
    } finally {
      setSubmitting(false);
    }
  }, [onSubmitPrice, priceValue, product]);

  const imageUrl = getProductImageUrl(product.img as any, product.barcode);
  const purchased = product.isPurchased;
  const price = formatPrice(product.lowestPrice);
  const originalPrice =
    product.hasActiveOffer && product.originalPrice ? formatPrice(product.originalPrice) : null;
  const aisle = product.aielNumber || product.locationCode;

  return (
    <Animated.View style={[styles.card, purchased && styles.cardPurchased]}>
      <Pressable
        style={styles.body}
        onPress={() => onOpenDetails(product)}
        android_ripple={{ color: Colors.light.backgroundSecondary }}
      >
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" transition={150} />
          ) : (
            <Ionicons name="cube-outline" size={24} color={Colors.light.textLight} />
          )}
          {product.quantity > 1 && (
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>×{product.quantity}</Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, purchased && styles.nameCollected]}
              numberOfLines={2}
            >
              {product.productName}
            </Text>
            <SizeBadge
              label={formatSizeLabel({
                title: product.productName,
                packetSize: product.packetSize,
                retailSize: product.retailSize,
              })}
            />
          </View>
          <View style={styles.metaRow}>
            {product.isFreeItem && (
              <View style={styles.freePill}>
                <Ionicons name="gift" size={10} color="#FFFFFF" />
                <Text style={styles.freePillText}>FREE</Text>
              </View>
            )}
            {!!product.category && (
              <View style={styles.metaPill}>
                <Text style={styles.metaText} numberOfLines={1}>
                  {product.category}
                </Text>
              </View>
            )}
            {!!aisle && (
              <View style={[styles.metaPill, styles.aislePill]}>
                <Ionicons name="location" size={11} color={Colors.light.primary} />
                <Text style={[styles.metaText, styles.aisleText]}>Aisle {aisle}</Text>
              </View>
            )}
          </View>
          <View style={styles.priceRow}>
            {!!price && <Text style={styles.price}>{price}</Text>}
            {!!originalPrice && <Text style={styles.priceOriginal}>{originalPrice}</Text>}
            {!!product.shopName && (
              <Text style={styles.shopName} numberOfLines={1}>
                · {product.shopName}
              </Text>
            )}
          </View>
        </View>

        <Pressable onPress={handleToggle} hitSlop={12} style={styles.checkTouch}>
          <Animated.View
            style={[styles.checkbox, purchased && styles.checkboxChecked, checkStyle]}
          >
            {purchased && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
          </Animated.View>
        </Pressable>
      </Pressable>

      {!purchased && !priceOpen && !reported && (
        <Pressable style={styles.priceWrongLink} onPress={() => setPriceOpen(true)} hitSlop={6}>
          <Ionicons name="pricetag-outline" size={13} color={Colors.light.textSecondary} />
          <Text style={styles.priceWrongText}>Price wrong?</Text>
        </Pressable>
      )}

      {reported && (
        <Animated.View entering={ZoomIn.duration(250)} exiting={FadeOut} style={styles.reportedRow}>
          <Ionicons name="checkmark-circle" size={15} color={Colors.light.success} />
          <Text style={styles.reportedText}>Price reported — thanks for helping!</Text>
        </Animated.View>
      )}

      {priceOpen && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.priceForm}>
          <View style={styles.priceInputWrap}>
            <Text style={styles.currency}>£</Text>
            <TextInput
              style={styles.priceInput}
              value={priceValue}
              onChangeText={setPriceValue}
              placeholder="Correct price"
              placeholderTextColor={Colors.light.textLight}
              keyboardType="decimal-pad"
              autoFocus
              maxLength={8}
            />
          </View>
          <Pressable
            style={[styles.priceSubmit, (!priceValue || submitting) && styles.priceSubmitDisabled]}
            disabled={!priceValue || submitting}
            onPress={handleSubmitPrice}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.priceSubmitText}>Report</Text>
            )}
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setPriceOpen(false);
              setPriceValue('');
            }}
          >
            <Ionicons name="close" size={18} color={Colors.light.textSecondary} />
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardPurchased: {
    opacity: 0.55,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  imageWrap: {
    width: 54,
    height: 54,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 48,
    height: 48,
  },
  qtyBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.light.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  qtyBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...Typography.bodyBold,
    fontSize: 15,
    color: Colors.light.text,
  },
  nameCollected: {
    textDecorationLine: 'line-through',
    color: Colors.light.textSecondary,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  freePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.light.success,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  freePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 160,
  },
  aislePill: {
    backgroundColor: Colors.light.primaryLight,
  },
  metaText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  aisleText: {
    color: Colors.light.primary,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    ...Typography.bodyBold,
    fontSize: 15,
    color: Colors.light.primary,
  },
  priceOriginal: {
    ...Typography.bodySmall,
    color: Colors.light.textLight,
    textDecorationLine: 'line-through',
  },
  shopName: {
    ...Typography.caption,
    color: Colors.light.textLight,
    flexShrink: 1,
  },
  checkTouch: {
    padding: 2,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.light.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  checkboxChecked: {
    backgroundColor: Colors.light.success,
    borderColor: Colors.light.success,
  },
  priceWrongLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm + 2,
    alignSelf: 'flex-start',
  },
  priceWrongText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    textDecorationLine: 'underline',
  },
  reportedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm + 2,
  },
  reportedText: {
    ...Typography.caption,
    color: Colors.light.success,
    fontWeight: '600',
  },
  priceForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  priceInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.sm + 2,
  },
  currency: {
    ...Typography.bodyBold,
    color: Colors.light.textSecondary,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 8,
    ...Typography.body,
    color: Colors.light.text,
  },
  priceSubmit: {
    backgroundColor: Colors.light.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 38,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceSubmitDisabled: {
    opacity: 0.5,
  },
  priceSubmitText: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
