import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { SizeBadge } from '@/components/ui/size-badge';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import {
  useReportProductSearch,
  useShopPrice,
  useShopsForProduct,
  useSubmitPriceReport,
} from '@/features/price-reports/hooks';
import { subscribeReportScan } from '@/features/price-reports/scan-bridge';
import type { ReportProduct, ReportShop } from '@/features/price-reports/types';
import { formatMoneyTyping } from '@/features/shop-tools/format';
import { formatSizeLabel } from '@/utils/pack-size';
import { getProductImageUrl } from '@/utils/product-image';

function money(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `£${Number(value).toFixed(2)}`;
}

/**
 * Wrong Price Report: find a product (typo-tolerant search or barcode scan),
 * pick the shop, enter the correct price and submit for admin review.
 */
export default function ReportPriceScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [product, setProduct] = useState<ReportProduct | null>(null);
  const [shop, setShop] = useState<ReportShop | null>(null);
  const [priceValue, setPriceValue] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const search = useReportProductSearch(searchInput);
  const shopsQuery = useShopsForProduct(product?.id ?? null);
  const priceQuery = useShopPrice(product?.id ?? null, shop?.id ?? null);
  const submit = useSubmitPriceReport();

  // Receive products scanned via the shared barcode scanner.
  useEffect(() => {
    return subscribeReportScan((scanned) => {
      setProduct(scanned);
      setShop(null);
      setSearchInput('');
    });
  }, []);

  const selectProduct = useCallback((p: ReportProduct) => {
    setProduct(p);
    setShop(null);
    setSearchInput('');
  }, []);

  const resetProduct = useCallback(() => {
    setProduct(null);
    setShop(null);
    setPriceValue('');
  }, []);

  const parsedPrice = useMemo(() => {
    const value = Number(priceValue.replace(',', '.'));
    return value > 0 ? value : null;
  }, [priceValue]);

  const handleSubmit = useCallback(async () => {
    if (!product || !shop || !parsedPrice) return;
    try {
      await submit.mutateAsync({
        productId: product.id,
        shopId: shop.id,
        reportedPrice: parsedPrice,
        currentPrice: priceQuery.data?.price,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSubmitted(true);
    } catch (error: any) {
      if (!error?.silent) showToast(error?.message ?? 'Could not submit report', 'error');
    }
  }, [product, shop, parsedPrice, submit, priceQuery.data?.price, showToast]);

  if (submitted) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View entering={ZoomIn.duration(400)} style={styles.successState}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={52} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>Report submitted</Text>
          <Text style={styles.successBody}>
            Thanks for helping keep prices accurate. Our team will review your report shortly.
          </Text>
          <View style={styles.successButtons}>
            <PrimaryButton
              title="Report Another"
              variant="ghost"
              onPress={() => {
                setSubmitted(false);
                resetProduct();
              }}
            />
            <PrimaryButton title="Done" onPress={() => router.back()} />
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>Report Wrong Price</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1 — product */}
          <StepLabel index={1} label="Product" done={!!product} />
          {product ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.selectedCard}>
              <SelectedProduct product={product} />
              <Pressable onPress={resetProduct} hitSlop={8} style={styles.changeButton}>
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
              <View style={styles.searchRow}>
                <View style={styles.searchInputWrap}>
                  <Ionicons name="search" size={18} color={Colors.light.textLight} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchInput}
                    onChangeText={setSearchInput}
                    placeholder="Search product name or barcode"
                    placeholderTextColor={Colors.light.textLight}
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {(search.isFetching || search.isDebouncing) && search.isSearchActive && (
                    <ActivityIndicator size="small" color={Colors.light.primary} />
                  )}
                </View>
                <Pressable
                  style={({ pressed }) => [styles.scanButton, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push({ pathname: '/(app)/scanner', params: { intent: 'report' } })}
                >
                  <Ionicons name="scan" size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              {search.isSearchActive && (search.data?.length ?? 0) === 0 && !search.isFetching && (
                <Text style={styles.noResults}>No products match “{search.searchTerm}”.</Text>
              )}

              {(search.data ?? []).map((item, index) => (
                <Animated.View key={item.id} entering={FadeInDown.duration(200).delay(index * 30)}>
                  <Pressable
                    style={({ pressed }) => [styles.resultRow, pressed && styles.rowPressed]}
                    onPress={() => selectProduct(item)}
                  >
                    <ProductThumb product={item} />
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {!!item.barcode && <Text style={styles.resultMeta}>{item.barcode}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.light.textLight} />
                  </Pressable>
                </Animated.View>
              ))}
            </>
          )}

          {/* Step 2 — shop */}
          {product && (
            <>
              <StepLabel index={2} label="Shop" done={!!shop} />
              {shop ? (
                <Animated.View entering={FadeIn.duration(200)} style={styles.selectedCard}>
                  <View style={styles.shopIcon}>
                    <Ionicons name="storefront" size={20} color={Colors.light.primary} />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{shop.name}</Text>
                    {!!shop.address && (
                      <Text style={styles.resultMeta} numberOfLines={1}>
                        {shop.address}
                      </Text>
                    )}
                  </View>
                  <Pressable onPress={() => setShop(null)} hitSlop={8} style={styles.changeButton}>
                    <Text style={styles.changeText}>Change</Text>
                  </Pressable>
                </Animated.View>
              ) : shopsQuery.isPending ? (
                <ActivityIndicator color={Colors.light.primary} style={{ marginVertical: Spacing.md }} />
              ) : (shopsQuery.data?.length ?? 0) === 0 ? (
                <Text style={styles.noResults}>No shops carry this product yet.</Text>
              ) : (
                (shopsQuery.data ?? []).map((item, index) => (
                  <Animated.View key={item.id} entering={FadeInDown.duration(200).delay(index * 30)}>
                    <Pressable
                      style={({ pressed }) => [styles.resultRow, pressed && styles.rowPressed]}
                      onPress={() => setShop(item)}
                    >
                      <View style={styles.shopIcon}>
                        <Ionicons name="storefront-outline" size={20} color={Colors.light.primary} />
                      </View>
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultName}>{item.name}</Text>
                        {!!item.address && (
                          <Text style={styles.resultMeta} numberOfLines={1}>
                            {item.address}
                          </Text>
                        )}
                      </View>
                      <ShopPriceTag productId={product.id} shopId={item.id} />
                    </Pressable>
                  </Animated.View>
                ))
              )}
            </>
          )}

          {/* Step 3 — correct price */}
          {product && shop && (
            <Animated.View entering={FadeInDown.duration(250)}>
              <StepLabel index={3} label="Correct price" done={!!parsedPrice} />
              <View style={styles.priceCard}>
                <View style={styles.currentPriceRow}>
                  <Text style={styles.currentPriceLabel}>Current listed price</Text>
                  {priceQuery.isPending ? (
                    <ActivityIndicator size="small" color={Colors.light.primary} />
                  ) : (
                    <Text style={styles.currentPriceValue}>{money(priceQuery.data?.price)}</Text>
                  )}
                </View>
                <View style={styles.priceInputWrap}>
                  <Text style={styles.currency}>£</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={priceValue}
                    onChangeText={(text) => setPriceValue(formatMoneyTyping(text))}
                    placeholder="Enter the correct price"
                    placeholderTextColor={Colors.light.textLight}
                    keyboardType="decimal-pad"
                    maxLength={8}
                  />
                </View>
                <PrimaryButton
                  title="Submit Report"
                  onPress={handleSubmit}
                  loading={submit.isPending}
                  disabled={!parsedPrice}
                />
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepLabel({ index, label, done }: { index: number; label: string; done: boolean }) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepBadge, done && styles.stepBadgeDone]}>
        {done ? (
          <Ionicons name="checkmark" size={13} color="#FFFFFF" />
        ) : (
          <Text style={styles.stepIndex}>{index}</Text>
        )}
      </View>
      <Text style={styles.stepLabel}>{label}</Text>
    </View>
  );
}

function ProductThumb({ product }: { product: ReportProduct }) {
  const url = getProductImageUrl(product.img as any, product.barcode);
  return (
    <View style={styles.thumb}>
      {url ? (
        <Image source={{ uri: url }} style={styles.thumbImage} contentFit="contain" />
      ) : (
        <Ionicons name="cube-outline" size={20} color={Colors.light.textLight} />
      )}
    </View>
  );
}

function SelectedProduct({ product }: { product: ReportProduct }) {
  return (
    <>
      <ProductThumb product={product} />
      <View style={styles.resultInfo}>
        <View style={styles.resultNameRow}>
          <Text style={styles.resultName} numberOfLines={2}>
            {product.title}
          </Text>
          <SizeBadge label={formatSizeLabel({ title: product.title })} />
        </View>
        {!!product.barcode && <Text style={styles.resultMeta}>{product.barcode}</Text>}
      </View>
    </>
  );
}

/** Lazy per-row current price so the shop list shows live prices. */
function ShopPriceTag({ productId, shopId }: { productId: string; shopId: string }) {
  const { data, isPending } = useShopPrice(productId, shopId);
  if (isPending) return <ActivityIndicator size="small" color={Colors.light.textLight} />;
  return <Text style={styles.shopPrice}>{money(data?.price)}</Text>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
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
  iconButtonPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  title: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: {
    backgroundColor: Colors.light.success,
    borderColor: Colors.light.success,
  },
  stepIndex: {
    ...Typography.caption,
    fontWeight: '800',
    color: Colors.light.textSecondary,
  },
  stepLabel: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    ...Typography.body,
    color: Colors.light.text,
  },
  scanButton: {
    width: 46,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  noResults: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginVertical: Spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rowPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    padding: Spacing.md,
  },
  changeButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  changeText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: 38,
    height: 38,
  },
  shopIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.light.text,
    flexShrink: 1,
  },
  resultNameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  resultMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  shopPrice: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
  priceCard: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  currentPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currentPriceLabel: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  currentPriceValue: {
    ...Typography.bodyBold,
    fontSize: 17,
    color: Colors.light.text,
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
  },
  currency: {
    ...Typography.h4,
    color: Colors.light.textSecondary,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    ...Typography.h4,
    color: Colors.light.text,
  },
  successState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  successIcon: {
    width: 104,
    height: 104,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  successTitle: {
    ...Typography.h3,
    color: Colors.light.text,
  },
  successBody: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  successButtons: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
  },
});
