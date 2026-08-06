import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { useCompareProduct } from '@/features/compare/hooks/use-compare-product';
import type { PurchaseOption } from '@/features/compare/types';
import { ListPickerSheet } from '@/features/home/components/list-picker-sheet';
import { useAddProduct } from '@/features/lists/hooks/use-list-details';
import type { Product, ShoppingList } from '@/features/lists/types';
import { getProductImageUrl } from '@/utils/product-image';

/**
 * Ranked comparison of every shop that stocks a product. The comparison
 * engine has already turned singles, quantity tiers and bundle promos into
 * a single sorted list keyed by effective per-unit price; here we just paint
 * cards and expose an "Add to List" flow.
 */
export default function CompareProductResultsScreen() {
  const params = useLocalSearchParams<{ productId: string }>();
  const productId = params.productId ?? '';
  const router = useRouter();
  const { showToast } = useToast();

  const compare = useCompareProduct(productId);
  const addProduct = useAddProduct();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingListId, setLoadingListId] = useState<string | null>(null);

  const product = compare.data?.product;
  const options = compare.options ?? [];

  const bestOption = options[0];
  const bestSavings = useMemo(() => {
    if (!bestOption) return null;
    // Highest single-item price across shops → shows the maximum savings
    // shoppers get by picking the best-value option instead of the worst one.
    let maxSingle = 0;
    for (const shop of compare.data?.shops ?? []) {
      if (shop.effectivePrice > maxSingle) maxSingle = shop.effectivePrice;
    }
    const diff = maxSingle - bestOption.effectiveUnitPrice;
    return diff > 0.005 ? diff : null;
  }, [bestOption, compare.data?.shops]);

  const handleAddToList = (list: ShoppingList) => {
    if (!product) return;
    setLoadingListId(list.id);
    const productForList: Product = {
      id: product.id,
      title: product.title,
      barcode: product.barcode ?? null,
      img: product.img,
      category: product.category ?? null,
      packetSize: product.packetSize ?? null,
      retailSize: product.retailSize ?? null,
      rrp: product.rrp ?? null,
    };
    addProduct.mutate(
      { listId: list.id, product: productForList, quantity: 1 },
      {
        onSuccess: () => {
          setLoadingListId(null);
          setPickerOpen(false);
          showToast(`Added to ${list.name}`, 'success');
        },
        onError: (error: any) => {
          setLoadingListId(null);
          showToast(error?.message ?? 'Failed to add product', 'error');
        },
      },
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.light.text} />
        </Pressable>
        <View style={styles.headerImageWrap}>
          {(() => {
            const imageUrl = product
              ? getProductImageUrl(product.img as any, product.barcode)
              : null;
            return imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.headerImage}
                contentFit="contain"
                transition={150}
              />
            ) : (
              <Ionicons name="cube-outline" size={22} color={Colors.light.textLight} />
            );
          })()}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>
            {product?.title ?? 'Compare'}
          </Text>
          {product?.packetSize ? (
            <Text style={styles.subtitle}>{product.packetSize}</Text>
          ) : product?.retailSize ? (
            <Text style={styles.subtitle}>{product.retailSize}</Text>
          ) : null}
        </View>
      </View>

      {compare.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.light.primary} />
          <Text style={styles.centerText}>Loading comparison…</Text>
        </View>
      ) : compare.isError ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.light.error} />
          <Text style={styles.centerText}>
            {(compare.error as Error)?.message ?? 'Could not load comparison'}
          </Text>
          <Pressable
            onPress={() => compare.refetch()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : options.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="storefront-outline" size={36} color={Colors.light.textLight} />
          <Text style={styles.centerText}>No shops currently stock this product.</Text>
        </View>
      ) : (
        <FlatList
          data={options}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Animated.View entering={FadeInUp.duration(280)} style={styles.summary}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryBadge}>
                  <Ionicons name="git-compare-outline" size={16} color={Colors.light.primary} />
                </View>
                <Text style={styles.summaryText}>
                  {compare.data?.shops.length ?? 0} shop
                  {(compare.data?.shops.length ?? 0) === 1 ? '' : 's'} · {options.length} option
                  {options.length === 1 ? '' : 's'}
                </Text>
              </View>
              {bestSavings != null && (
                <Text style={styles.summarySavings}>
                  Save up to £{bestSavings.toFixed(2)} per item with the best value
                </Text>
              )}
            </Animated.View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 6) * 40)}>
              <OptionCard
                option={item}
                onAdd={item.isBestValue ? () => setPickerOpen(true) : undefined}
              />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          ListFooterComponent={
            options.length > 0 ? (
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={({ pressed }) => [styles.footerCta, pressed && styles.footerCtaPressed]}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.footerCtaText}>Add best value to a list</Text>
              </Pressable>
            ) : null
          }
        />
      )}

      <ListPickerSheet
        visible={pickerOpen}
        productName={product?.title ?? null}
        loadingListId={loadingListId}
        onSelect={handleAddToList}
        onClose={() => {
          if (loadingListId == null) setPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

interface OptionCardProps {
  option: PurchaseOption;
  onAdd?: () => void;
}

function OptionCard({ option, onAdd }: OptionCardProps) {
  const savings = option.savingsPerUnit > 0.005 ? option.savingsPerUnit : null;

  return (
    <View style={[styles.card, option.isBestValue && styles.cardBest]}>
      {option.isBestValue && (
        <View style={styles.bestBadge}>
          <Ionicons name="star" size={12} color="#FFFFFF" />
          <Text style={styles.bestBadgeText}>BEST VALUE</Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName} numberOfLines={1}>
            {option.shopName}
          </Text>
          {option.shopAddress && (
            <Text style={styles.shopAddress} numberOfLines={1}>
              {option.shopAddress}
            </Text>
          )}
        </View>
        <View style={styles.priceCol}>
          <Text style={styles.unitPrice}>£{option.effectiveUnitPrice.toFixed(2)}</Text>
          <Text style={styles.unitPriceLabel}>per item</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.kindPill}>
          <Ionicons
            name={
              option.kind === 'bundle'
                ? 'gift-outline'
                : option.kind === 'tier'
                  ? 'layers-outline'
                  : option.hasActiveOffer
                    ? 'pricetag'
                    : 'pricetag-outline'
            }
            size={12}
            color={Colors.light.primary}
          />
          <Text style={styles.kindPillText}>{option.label}</Text>
        </View>
        {option.detail && <Text style={styles.detail}>{option.detail}</Text>}
        {option.hasActiveOffer && option.offerExpiryDate && (
          <Text style={styles.offerNote}>
            Offer ends {new Date(option.offerExpiryDate).toLocaleDateString()}
          </Text>
        )}
        {savings != null && (
          <Text style={styles.savingsText}>
            Saves £{savings.toFixed(2)} per item vs this shop&apos;s single price
          </Text>
        )}
      </View>

      {onAdd && (
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Ionicons name="add" size={16} color={Colors.light.primary} />
          <Text style={styles.addButtonText}>Add to list</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: { backgroundColor: Colors.light.backgroundSecondary },
  headerImageWrap: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  headerImage: { width: '100%', height: '100%' },
  title: { ...Typography.h4, color: Colors.light.text },
  subtitle: { ...Typography.caption, color: Colors.light.textSecondary },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  centerText: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primary,
  },
  retryButtonPressed: { opacity: 0.85 },
  retryText: { ...Typography.bodyBold, color: '#FFFFFF' },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  summary: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: Spacing.xs,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  summaryBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundCard,
  },
  summaryText: { ...Typography.bodyBold, color: Colors.light.text },
  summarySavings: { ...Typography.bodySmall, color: Colors.light.success },
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardBest: {
    borderColor: Colors.light.primary,
    borderWidth: 2,
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  bestBadgeText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  shopName: { ...Typography.bodyBold, color: Colors.light.text },
  shopAddress: { ...Typography.caption, color: Colors.light.textSecondary },
  priceCol: { alignItems: 'flex-end' },
  unitPrice: { ...Typography.h3, color: Colors.light.primary },
  unitPriceLabel: { ...Typography.caption, color: Colors.light.textSecondary },
  cardBody: { gap: 4 },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  kindPillText: { ...Typography.caption, color: Colors.light.primary, fontWeight: '600' },
  detail: { ...Typography.bodySmall, color: Colors.light.textSecondary },
  offerNote: { ...Typography.caption, color: Colors.light.success },
  savingsText: { ...Typography.caption, color: Colors.light.success },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  addButtonPressed: { backgroundColor: Colors.light.primaryLight },
  addButtonText: { ...Typography.bodyBold, color: Colors.light.primary },
  footerCta: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primary,
  },
  footerCtaPressed: { opacity: 0.9 },
  footerCtaText: { ...Typography.bodyBold, color: '#FFFFFF' },
});
