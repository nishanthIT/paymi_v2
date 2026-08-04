import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SizeBadge } from '@/components/ui/size-badge';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { formatSizeLabel } from '@/utils/pack-size';
import { getProductImageUrl } from '@/utils/product-image';

import { usePackOptions, usePriceTiers } from '../hooks/use-smart-add';
import type { PackOption, PriceTier, Product } from '../types';
import { QuantityStepper } from './quantity-stepper';

interface ProductSheetProps {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
  /** Called with the chosen quantity. Sheet closes immediately (optimistic). */
  onAdd: (product: Product, quantity: number) => void;
  /** True when this product is already in the target list. */
  inList?: boolean;
}

/** Product details bottom sheet with quantity selection (default 1, min 1). */
export function ProductSheet({ product, visible, onClose, onAdd, inList }: ProductSheetProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const { data: packData } = usePackOptions(visible ? product?.id : null);
  const packOptions = useMemo(
    () => (packData?.hasOptions ? packData.options : []),
    [packData],
  );

  const { data: tierData } = usePriceTiers(visible ? product?.id : null);
  const priceTiers = useMemo(
    () => (tierData?.hasTiers ? tierData.tiers : []),
    [tierData],
  );

  useEffect(() => {
    if (visible) {
      setQuantity(1);
      setSelectedOptionId(null);
    }
  }, [visible, product?.id]);

  if (!product) return null;

  const imageUrl = getProductImageUrl(product.img as any, product.barcode);
  const sizeLabel = formatSizeLabel(product);

  const selectedOption =
    packOptions.find((o) => o.productId === (selectedOptionId ?? product.id)) ?? null;

  const handleAdd = () => {
    // When a different pack size was chosen, add that variant instead.
    if (selectedOption && !selectedOption.isCurrent) {
      onAdd(
        {
          id: selectedOption.productId,
          title: selectedOption.title,
          barcode: selectedOption.barcode,
          img: selectedOption.img,
          packetSize: selectedOption.packetSize,
          retailSize: selectedOption.retailSize,
          caseSize: selectedOption.caseSize,
          category: selectedOption.category,
          availableInShops: selectedOption.availableInShops,
          lowestPrice: selectedOption.price,
        },
        quantity,
      );
    } else {
      onAdd(product, quantity);
    }
  };

  const displayPrice = selectedOption?.price ?? product.lowestPrice;
  // Tiers only apply to the scanned product, not a swapped pack variant.
  const tiersApply = !selectedOption || selectedOption.isCurrent;
  const activeTier = tiersApply
    ? priceTiers.find((t) => t.quantity === quantity) ?? null
    : null;

  const singlePrice = tierData?.basePrice ?? (displayPrice != null ? Number(displayPrice) : null);
  // Best value = lowest unit price among the packs that actually beat singles.
  const bestValueQuantity = priceTiers.reduce<PriceTier | null>((best, t) => {
    if (singlePrice != null && t.unitPrice >= singlePrice) return best;
    return !best || t.unitPrice < best.unitPrice ? t : best;
  }, null)?.quantity;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.imageWrapper}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" transition={200} />
        ) : (
          <Ionicons name="cube-outline" size={48} color={Colors.light.textLight} />
        )}
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>{product.title}</Text>
        {!!sizeLabel && <SizeBadge label={sizeLabel} />}
      </View>

      <View style={styles.metaGrid}>
        {!!product.barcode && (
          <View style={styles.metaItem}>
            <Ionicons name="barcode-outline" size={16} color={Colors.light.textSecondary} />
            <Text style={styles.metaText}>{product.barcode}</Text>
          </View>
        )}
        {!!product.category && (
          <View style={styles.metaItem}>
            <Ionicons name="pricetag-outline" size={16} color={Colors.light.textSecondary} />
            <Text style={styles.metaText}>{product.category}</Text>
          </View>
        )}
        {product.availableInShops != null && (
          <View style={styles.metaItem}>
            <Ionicons name="storefront-outline" size={16} color={Colors.light.textSecondary} />
            <Text style={styles.metaText}>
              Available in {product.availableInShops}{' '}
              {product.availableInShops === 1 ? 'shop' : 'shops'}
            </Text>
          </View>
        )}
      </View>

      {packOptions.length > 1 && (
        <View style={styles.packSection}>
          <Text style={styles.packTitle}>Pack sizes — best unit price wins</Text>
          {packOptions.map((option) => (
            <PackOptionRow
              key={option.productId}
              option={option}
              selected={(selectedOptionId ?? product.id) === option.productId}
              onSelect={() => setSelectedOptionId(option.productId)}
            />
          ))}
        </View>
      )}

      {tiersApply && priceTiers.length > 0 && (
        <View style={styles.packSection}>
          <Text style={styles.packTitle}>Pick your pack — buy more, pay less</Text>
          {singlePrice != null && (
            <TierRow
              label="Single"
              price={singlePrice}
              unitPrice={singlePrice}
              selected={!priceTiers.some((t) => t.quantity === quantity)}
              onSelect={() => setQuantity(1)}
            />
          )}
          {priceTiers.map((tier) => (
            <TierRow
              key={tier.quantity}
              label={`Pack of ${tier.quantity}`}
              price={tier.price}
              unitPrice={tier.unitPrice}
              savingsPerItem={
                singlePrice != null && singlePrice > tier.unitPrice
                  ? singlePrice - tier.unitPrice
                  : null
              }
              isBestValue={tier.quantity === bestValueQuantity}
              selected={quantity === tier.quantity}
              onSelect={() => setQuantity(tier.quantity)}
            />
          ))}
        </View>
      )}

      {activeTier ? (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Deal price × {activeTier.quantity}</Text>
          <View style={styles.dealPriceCol}>
            <Text style={styles.price}>£{activeTier.price.toFixed(2)}</Text>
            {activeTier.savings != null && activeTier.savings > 0 && (
              <Text style={styles.dealSavings}>Save £{activeTier.savings.toFixed(2)}</Text>
            )}
          </View>
        </View>
      ) : (
        displayPrice != null && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Best price</Text>
            <Text style={styles.price}>£{Number(displayPrice).toFixed(2)}</Text>
          </View>
        )
      )}

      <View style={styles.quantityRow}>
        <Text style={styles.quantityLabel}>Quantity</Text>
        <QuantityStepper value={quantity} onChange={setQuantity} />
      </View>

      {inList && (
        <View style={styles.inListNote}>
          <Ionicons name="information-circle" size={16} color={Colors.light.primary} />
          <Text style={styles.inListText}>Already in this list — quantity will be increased.</Text>
        </View>
      )}

      <View style={styles.actions}>
        <PrimaryButton
          title={inList ? 'Increase Quantity' : 'Add to List'}
          onPress={handleAdd}
        />
        <PrimaryButton title="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

function PackOptionRow({
  option,
  selected,
  onSelect,
}: {
  option: PackOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.packRow,
        selected && styles.packRowSelected,
        pressed && { opacity: 0.9 },
      ]}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={18}
        color={selected ? Colors.light.primary : Colors.light.textLight}
      />
      <View style={styles.packInfo}>
        <View style={styles.packLabelRow}>
          <Text style={styles.packLabel} numberOfLines={1}>
            {option.sizeLabel ?? option.title}
          </Text>
          {option.isBestValue && (
            <View style={styles.bestValuePill}>
              <Ionicons name="star" size={9} color="#FFFFFF" />
              <Text style={styles.bestValueText}>Best value</Text>
            </View>
          )}
        </View>
        {option.unitPrice != null && (
          <Text style={styles.packUnit}>£{option.unitPrice.toFixed(2)} each</Text>
        )}
      </View>
      <Text style={styles.packPrice}>
        {option.price != null ? `£${option.price.toFixed(2)}` : '—'}
      </Text>
    </Pressable>
  );
}

function TierRow({
  label,
  price,
  unitPrice,
  savingsPerItem,
  isBestValue,
  selected,
  onSelect,
}: {
  label: string;
  price: number;
  unitPrice: number;
  savingsPerItem?: number | null;
  isBestValue?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.packRow,
        selected && styles.packRowSelected,
        pressed && { opacity: 0.9 },
      ]}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={18}
        color={selected ? Colors.light.primary : Colors.light.textLight}
      />
      <View style={styles.packInfo}>
        <View style={styles.packLabelRow}>
          <Text style={styles.packLabel}>{label}</Text>
          {isBestValue && (
            <View style={styles.bestValuePill}>
              <Ionicons name="star" size={9} color="#FFFFFF" />
              <Text style={styles.bestValueText}>Best value</Text>
            </View>
          )}
        </View>
        <Text style={styles.packUnit}>£{unitPrice.toFixed(2)} each</Text>
        {savingsPerItem != null && savingsPerItem > 0.004 && (
          <Text style={styles.tierSavings}>
            Save £{savingsPerItem.toFixed(2)} per item
          </Text>
        )}
      </View>
      <Text style={styles.packPrice}>£{price.toFixed(2)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageWrapper: {
    alignSelf: 'center',
    width: 140,
    height: 140,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h4,
    color: Colors.light.text,
    textAlign: 'center',
    flexShrink: 1,
  },
  packSection: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  packTitle: {
    ...Typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: Colors.light.textLight,
    marginBottom: 2,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    backgroundColor: Colors.light.backgroundCard,
  },
  packRowSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryLight,
  },
  packInfo: {
    flex: 1,
    gap: 1,
  },
  packLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packLabel: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.text,
    flexShrink: 1,
  },
  bestValuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.light.success,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bestValueText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  packUnit: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  tierSavings: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.success,
  },
  packPrice: {
    ...Typography.bodySmall,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  metaGrid: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.primaryLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  priceLabel: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  price: {
    ...Typography.h4,
    color: Colors.light.primary,
  },
  dealPriceCol: {
    alignItems: 'flex-end',
  },
  dealSavings: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.success,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  quantityLabel: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  inListNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  inListText: {
    ...Typography.caption,
    color: Colors.light.primary,
    flexShrink: 1,
  },
  actions: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
});
