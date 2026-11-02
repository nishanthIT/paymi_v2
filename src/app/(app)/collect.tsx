import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ui/progress-bar';
import { ImageViewer } from '@/components/ui/image-viewer';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { CollectDetailsSheet } from '@/features/collect/components/collect-details-sheet';
import { CollectProductCard } from '@/features/collect/components/collect-product-card';
import { collectionProducts, summarizeCollectionShops } from '@/features/collect/model';
import { ShopSelector } from '@/features/collect/components/shop-selector';
import {
  useChangeShop,
  useListDetails,
  useMarkOutOfStock,
  useMoveToList,
  useTogglePurchased,
  useToggleUrgent,
} from '@/features/lists/hooks/use-list-details';
import { useShopFeature } from '@/features/employees/permissions';
import { usePullToRefresh, useRefetchOnFocus } from '@/hooks/use-query-refresh';
import { OUT_OF_STOCK_ID } from '@/features/lists/out-of-stock';
import type { ListProduct } from '@/features/lists/types';
import { useSubmitPriceReport } from '@/features/price-reports/hooks';

/**
 * Collect Mode: shop-by-shop guided collection. Products are grouped by the
 * shop where they are cheapest (chosen by the backend when they were added),
 * with instant local shop/category/aisle filters, animated progress and
 * inline wrong-price reporting. Works offline — check-offs and reports are
 * queued and synced automatically.
 */
export default function CollectScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { data: list, isLoading, isFetching, isError, fetchStatus, refetch } = useListDetails(listId ?? '');
  const { refreshing, onRefresh } = usePullToRefresh(refetch, fetchStatus);
  useRefetchOnFocus(refetch);
  const hasEdit = useShopFeature('feature.lists', 'edit');
  const canEdit = hasEdit && list?.canEdit !== false;
  const toggle = useTogglePurchased(listId ?? '');
  const toggleUrgent = useToggleUrgent(listId ?? '');
  const changeShop = useChangeShop(listId ?? '');
  const moveToList = useMoveToList(listId ?? '');
  const markOutOfStock = useMarkOutOfStock(listId ?? '');
  const submitReport = useSubmitPriceReport();

  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [aisle, setAisle] = useState<string | null>(null);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const products = useMemo(() => list?.products ?? [], [list?.products]);
  // Look up live so the sheet reflects fresh data once a background refetch lands.
  const details = useMemo(
    () => products.find((p) => p.id === detailsId) ?? null,
    [products, detailsId],
  );
  const collected = products.filter((p) => p.isPurchased).length;
  const total = products.length;

  const shops = useMemo(() => summarizeCollectionShops(products), [products]);

  // Products at the selected shop (before category/aisle filters) drive the
  // filter chip options so options always match what is on screen.
  const shopProducts = useMemo(
    () =>
      selectedShopId
        ? products.filter((p) => (p.shopId || 'unknown') === selectedShopId)
        : products,
    [products, selectedShopId],
  );

  const categories = useMemo(
    () =>
      Array.from(new Set(shopProducts.map((p) => p.category).filter(Boolean))).sort() as string[],
    [shopProducts],
  );
  const aisles = useMemo(
    () =>
      Array.from(
        new Set(
          shopProducts.map((p) => p.aielNumber || p.locationCode).filter(Boolean),
        ),
        // Natural order so Aisle 2 comes before Aisle 10.
      ).sort((a, b) =>
        (a as string).localeCompare(b as string, undefined, { numeric: true, sensitivity: 'base' }),
      ) as string[],
    [shopProducts],
  );

  const hasUrgent = useMemo(() => shopProducts.some((p) => p.isUrgent), [shopProducts]);

  const visible = useMemo(
    () => collectionProducts(shopProducts, { category, aisle, urgentOnly }),
    [shopProducts, category, aisle, urgentOnly],
  );

  // Interleave a header row before each bundle group so the employee sees
  // which products belong together, the free item, and live bundle progress.
  type CollectRow =
    | { type: 'product'; item: ListProduct }
    | {
        type: 'bundle-header';
        key: string;
        collected: number;
        total: number;
        freeLabel: string | null;
      };

  const rows = useMemo<CollectRow[]>(() => {
    const out: CollectRow[] = [];
    let lastBundleId: string | null = null;
    for (const item of visible) {
      const bundleId = item.bundlePromotionId ?? null;
      if (bundleId && bundleId !== lastBundleId) {
        const group = visible.filter((p) => p.bundlePromotionId === bundleId);
        const freeItems = group.filter((p) => (p.freeQuantity ?? 0) > 0);
        out.push({
          type: 'bundle-header',
          key: `bundle-${bundleId}`,
          collected: group.filter((p) => p.isPurchased).length,
          total: group.length,
          freeLabel: freeItems.length
            ? freeItems.map((p) => `${p.freeQuantity} × ${p.productName}`).join(', ')
            : null,
        });
      }
      lastBundleId = bundleId;
      out.push({ type: 'product', item });
    }
    return out;
  }, [visible]);

  const handleSelectShop = useCallback((shopId: string | null) => {
    setSelectedShopId(shopId);
    setCategory(null);
    setAisle(null);
  }, []);

  const handleToggle = useCallback(
    (product: ListProduct) => {
      if (!canEdit) return;
      toggle.mutate(product.id, {
        onError: (error: any) => {
          if (!error?.silent) showToast(error?.message ?? 'Could not update item', 'error');
        },
      });
    },
    [toggle, showToast, canEdit],
  );

  const handleSubmitPrice = useCallback(
    async (product: ListProduct, reportedPrice: number) => {
      try {
        await submitReport.mutateAsync({
          productAtShopId: product.productAtShopId || undefined,
          productId: product.productAtShopId ? undefined : product.productId,
          shopId: product.productAtShopId ? undefined : product.shopId,
          reportedPrice,
          currentPrice: product.lowestPrice ?? undefined,
        });
        showToast('Price report submitted', 'success');
      } catch (error: any) {
        if (!error?.silent) showToast(error?.message ?? 'Could not submit report', 'error');
        throw error;
      }
    },
    [submitReport, showToast],
  );

  const allDone = total > 0 && collected === total;
  const percent = total > 0 ? Math.round((collected / total) * 100) : 0;

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
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>
            {list?.name ?? 'Collect'}
          </Text>
          <Text style={styles.subtitle}>Collect Mode</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <Animated.View entering={FadeInUp.duration(350)} style={styles.progressCard}>
        <View style={styles.progressTextRow}>
          <Text style={styles.progressText}>
            <Text style={styles.progressStrong}>{collected}</Text> of {total} collected
          </Text>
          <Text style={styles.progressPercent}>{percent}%</Text>
        </View>
        <ProgressBar
          progress={total > 0 ? collected / total : 0}
          height={10}
          color={allDone ? Colors.light.success : Colors.light.primary}
        />
      </Animated.View>

      <View>
        <ShopSelector
          shops={shops}
          selectedShopId={selectedShopId}
          onSelect={handleSelectShop}
          overallTotal={total}
          overallCollected={collected}
        />
      </View>

      {shopProducts.length > 0 && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <FilterChip
              label={`Urgent${hasUrgent ? '' : ' (none)'}`}
              icon="alert-circle"
              active={urgentOnly}
              onPress={() => setUrgentOnly((on) => !on)}
            />
            {categories.length > 1 &&
              categories.map((c) => (
                <FilterChip
                  key={`c-${c}`}
                  label={c}
                  active={category === c}
                  onPress={() => setCategory(category === c ? null : c)}
                />
              ))}
            {aisles.length > 0 &&
              aisles.map((a) => (
                <FilterChip
                  key={`a-${a}`}
                  label={`Aisle ${a}`}
                  icon="location"
                  active={aisle === a}
                  onPress={() => setAisle(aisle === a ? null : a)}
                />
              ))}
          </ScrollView>
        </View>
      )}

        <FlatList
          data={rows}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={allDone ? <Text style={styles.doneTitle}>All collected!</Text> : list && isError ? <Text style={styles.emptyText}>Couldn’t refresh. Pull down to retry.</Text> : undefined}
          keyExtractor={(row) => (row.type === 'product' ? row.item.id : row.key)}
          renderItem={({ item: row }) =>
            row.type === 'bundle-header' ? (
              <Animated.View
                entering={FadeInDown.duration(250)}
                layout={LinearTransition.springify().damping(26)}
                style={[
                  styles.bundleHeader,
                  row.collected === row.total && styles.bundleHeaderDone,
                ]}
              >
                <Ionicons
                  name={row.collected === row.total ? 'checkmark-circle' : 'gift'}
                  size={16}
                  color={row.collected === row.total ? Colors.light.success : Colors.light.primary}
                />
                <View style={styles.bundleHeaderText}>
                  <Text style={styles.bundleHeaderTitle}>
                    Bundle Offer · {row.collected}/{row.total} collected
                    {row.collected === row.total ? ' — complete!' : ''}
                  </Text>
                  {!!row.freeLabel && (
                    <Text style={styles.bundleHeaderFree} numberOfLines={2}>
                      🎁 Collect {row.freeLabel} FREE
                    </Text>
                  )}
                </View>
              </Animated.View>
            ) : (
              <Animated.View
                entering={FadeInDown.duration(250)}
                layout={LinearTransition.springify().damping(26)}
                style={row.item.bundlePromotionId ? styles.bundleItemIndent : undefined}
              >
                <CollectProductCard
                  product={row.item}
                  readOnly={!canEdit}
                  onToggle={handleToggle}
                  onOpenDetails={(p) => setDetailsId(p.id)}
                  onPreviewImage={setPreviewUri}
                  onSubmitPrice={handleSubmitPrice}
                />
              </Animated.View>
            )
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="funnel-outline" size={32} color={Colors.light.textLight} />
              {isLoading && fetchStatus !== 'paused' ? <ActivityIndicator color={Colors.light.primary} /> : <>
                <Text style={styles.emptyText}>{isError ? 'Couldn’t load this list.' : fetchStatus === 'paused' && !list ? 'You’re offline. Reconnect to load this list.' : 'No items match these filters.'}</Text>
                {isError && <Pressable onPress={() => refetch()} accessibilityRole="button"><Text style={styles.emptyText}>Try again</Text></Pressable>}
              </>}
            </View>
          }
        />

      <ImageViewer
        uri={previewUri}
        visible={!!previewUri}
        onClose={() => setPreviewUri(null)}
        presentation="preview"
      />
      <CollectDetailsSheet
        product={details}
        isLoading={isLoading || isFetching}
        onClose={() => setDetailsId(null)}
        onToggleUrgent={canEdit ? (listProductId) =>
          toggleUrgent.mutate(listProductId, {
            onError: (error) => showToast(error.message, 'error'),
          }) : undefined
        }
        changingShop={changeShop.isPending}
        onChangeShop={canEdit ? (listProductId, productAtShopId) =>
          changeShop.mutate(
            { listProductId, productAtShopId },
            {
              onSuccess: (result) => {
                showToast(result?.message ?? 'Moved to the selected shop', 'success');
                setDetailsId(null);
              },
              onError: (error) => showToast(error.message, 'error'),
            },
          ) : undefined
        }
        listId={listId}
        movingList={moveToList.isPending || markOutOfStock.isPending}
        onMoveToList={canEdit ? (listProductId, targetListId) => {
          setDetailsId(null);
          moveToList.mutate(
            { listProductId, targetListId },
            {
              onSuccess: (result) => showToast(result?.message ?? 'Moved to the selected list', 'success'),
              onError: (error: any) => {
                if (!error?.silent) showToast(error?.message ?? 'Could not move item', 'error');
              },
            },
          );
        } : undefined}
        onMarkOutOfStock={canEdit && listId !== OUT_OF_STOCK_ID ? (listProductId) => {
          setDetailsId(null);
          markOutOfStock.mutate(
            { listProductId },
            {
              onSuccess: (result) =>
                showToast(
                  result?.created
                    ? `Created “${result.targetListName}” and moved item`
                    : (result?.message ?? 'Marked as out of stock'),
                  'success',
                ),
              onError: (error: any) => {
                if (!error?.silent) showToast(error?.message ?? 'Could not mark out of stock', 'error');
              },
            },
          );
        } : undefined}
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={12}
          color={active ? '#FFFFFF' : Colors.light.textSecondary}
        />
      )}
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
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
    maxWidth: 220,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.light.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  bundleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.light.primaryLight,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    marginBottom: Spacing.xs,
  },
  bundleHeaderDone: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderColor: Colors.light.success,
  },
  bundleHeaderText: {
    flex: 1,
    gap: 1,
  },
  bundleHeaderTitle: {
    ...Typography.caption,
    fontWeight: '800',
    color: Colors.light.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bundleHeaderFree: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  bundleItemIndent: {
    marginLeft: Spacing.sm,
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  progressStrong: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  progressPercent: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
  filterRow: {
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.sm + 4,
    height: 30,
    maxWidth: 180,
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  filterChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xxl,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  doneState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  doneIcon: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    backgroundColor: '#E8F5EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  doneTitle: {
    ...Typography.h3,
    color: Colors.light.text,
  },
  doneBody: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
