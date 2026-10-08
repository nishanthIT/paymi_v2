import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui/toast';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { ExportPdfSheet } from '@/features/lists/components/export-pdf-sheet';
import { ListProductRow } from '@/features/lists/components/list-product-row';
import { ListQuickActions } from '@/features/lists/components/list-quick-actions';
import { ListProductRowsSkeleton } from '@/features/lists/components/list-skeletons';
import { exportListPdf } from '@/features/lists/pdf/export-list-pdf';
import {
  useListDetails,
  useRemoveProduct,
  useToggleUrgent,
  useUpdateQuantity,
} from '@/features/lists/hooks/use-list-details';
import { useRenameList } from '@/features/lists/hooks/use-lists';
import type { ListProduct } from '@/features/lists/types';
import { usePullToRefresh, useRefetchOnFocus } from '@/hooks/use-query-refresh';
import { matchesSearch } from '@/utils/search';

/**
 * List details: instant in-list search, check-off progress, quantity
 * management, and entry points for adding products and Collect Mode.
 */
export default function ListDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = id ?? '';
  const router = useRouter();
  const { showToast } = useToast();

  const { data: list, isError, fetchStatus, refetch } = useListDetails(listId);
  const { refreshing, onRefresh } = usePullToRefresh(refetch, fetchStatus);
  useRefetchOnFocus(refetch);
  const removeProduct = useRemoveProduct(listId);
  const updateQuantity = useUpdateQuantity(listId);
  const toggleUrgent = useToggleUrgent(listId);
  const renameList = useRenameList();

  const [filter, setFilter] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const openRename = () => {
    setRenameValue(list?.name ?? '');
    setRenameOpen(true);
  };

  const handleRename = () => {
    const name = renameValue.trim();
    if (!name || name === list?.name) {
      setRenameOpen(false);
      return;
    }
    renameList.mutate(
      { listId, name },
      {
        onSuccess: () => setRenameOpen(false),
        onError: (error) => showToast(error.message, 'error'),
      },
    );
  };

  const handleExport = async ({ barcodeShopId }: { barcodeShopId: string | null }) => {
    if (!list) return;
    setExporting(true);
    try {
      await exportListPdf(list, { barcodeShopId });
      setExportOpen(false);
    } catch (error: any) {
      showToast(error?.message ?? 'Could not export PDF', 'error');
    } finally {
      setExporting(false);
    }
  };

  const products = useMemo(() => {
    const all = list?.products ?? [];
    const term = filter.trim();
    const filtered = term
      ? all.filter((p) => matchesSearch(term, p.productName, p.barcode, p.category))
      : all;
    // Bundle items stay grouped together (bundles first, keyed by promotion);
    // everything else is newest-first — cuid ids are time-ordered, so sorting
    // by id desc works even when the backend returns insertion order.
    return [...filtered].sort((a, b) => {
      const bundleA = a.bundlePromotionId ?? '';
      const bundleB = b.bundlePromotionId ?? '';
      if (!!bundleA !== !!bundleB) return bundleA ? -1 : 1;
      if (bundleA !== bundleB) return bundleA.localeCompare(bundleB);
      // Within a bundle: paid items before free items.
      if (bundleA && !!a.isFreeItem !== !!b.isFreeItem) return a.isFreeItem ? 1 : -1;
      return b.id.localeCompare(a.id); // 'optimistic-' rows sort above cuids too
    });
  }, [list?.products, filter]);

  const total = list?.products?.length ?? 0;
  const collected = list?.products?.filter((p) => p.isPurchased).length ?? 0;

  const onError = (error: Error) => showToast(error.message, 'error');

  const confirmRemove = (item: ListProduct) =>
    Alert.alert('Remove item', `Remove "${item.productName}" from this list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeProduct.mutate(item.productId, { onError }),
      },
    ]);

  // No cached list yet: skeleton while loading/restoring, retry state once it gives up.
  const isOffline = fetchStatus === 'paused';
  const loadFailed = !list && fetchStatus !== 'fetching' && (isError || isOffline);
  const showSkeleton = !list && !loadFailed && !!listId;

  const renderItem = ({ item }: { item: ListProduct }) => (
    <Animated.View layout={LinearTransition.springify().damping(20)}>
      <ListProductRow
        item={item}
        onQuantityChange={(quantity) =>
          updateQuantity.mutate({ listProductId: item.id, quantity }, { onError })
        }
        onRemove={() => confirmRemove(item)}
        onToggleUrgent={() => toggleUrgent.mutate(item.id, { onError })}
      />
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.light.text} />
          </Pressable>
          <Pressable
            onPress={openRename}
            hitSlop={6}
            style={({ pressed }) => [styles.headerTitleWrap, pressed && { opacity: 0.6 }]}
          >
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {list?.name ?? 'List'}
              </Text>
              <Ionicons name="pencil" size={13} color={Colors.light.textLight} />
            </View>
            <Text style={styles.subtitle}>
              {collected} of {total} collected
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setExportOpen(true)}
            hitSlop={10}
            disabled={!list || (list.products?.length ?? 0) === 0}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
              (!list || (list.products?.length ?? 0) === 0) && styles.iconButtonDisabled,
            ]}
          >
            <Ionicons name="print-outline" size={19} color={Colors.light.text} />
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/(app)/collect', params: { listId } })
            }
            style={({ pressed }) => [styles.collectButton, pressed && styles.collectPressed]}
          >
            <Ionicons name="navigate" size={14} color="#FFFFFF" />
            <Text style={styles.collectText}>Collect Now</Text>
          </Pressable>
        </View>

        {total > 0 && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${total ? Math.round((collected / total) * 100) : 0}%` },
              ]}
            />
          </View>
        )}

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.light.textLight} />
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder="Search in this list"
            placeholderTextColor={Colors.light.textLight}
            style={styles.searchInput}
          />
          {filter.length > 0 && (
            <Pressable onPress={() => setFilter('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.light.textLight} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.light.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={
          showSkeleton ? (
            <Animated.View exiting={FadeOut.duration(200)}>
              <ListProductRowsSkeleton />
            </Animated.View>
          ) : loadFailed ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={isOffline ? 'cloud-offline-outline' : 'alert-circle-outline'}
                  size={40}
                  color={Colors.light.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {isOffline ? 'You’re offline' : 'Couldn’t load this list'}
              </Text>
              <Text style={styles.emptyBody}>
                {isOffline
                  ? 'This list will load as soon as you’re back online.'
                  : 'Check your connection and try again.'}
              </Text>
              {!isOffline && (
                <Pressable
                  onPress={() => refetch()}
                  style={({ pressed }) => [
                    styles.collectButton,
                    styles.retryButton,
                    pressed && styles.collectPressed,
                  ]}
                >
                  <Ionicons name="refresh" size={14} color="#FFFFFF" />
                  <Text style={styles.collectText}>Try again</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="basket-outline" size={40} color={Colors.light.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter ? 'Nothing matches your search' : 'This list is empty'}
              </Text>
              <Text style={styles.emptyBody}>
                {filter
                  ? 'Try a different product name or barcode.'
                  : 'Add products by searching or scanning a barcode.'}
              </Text>
            </View>
          )
        }
      />

      <Animated.View entering={FadeInDown.duration(300)} style={styles.quickActionsWrap}>
        <ListQuickActions
          onScan={() => router.push({ pathname: '/(app)/scanner', params: { listId } })}
          onAddProduct={() => router.push({ pathname: '/(app)/add-product', params: { listId } })}
        />
      </Animated.View>

      <ExportPdfSheet
        visible={exportOpen}
        products={list?.products ?? []}
        exporting={exporting}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
      />

      <BottomSheet visible={renameOpen} onClose={() => setRenameOpen(false)} keyboardAware>
        <View style={styles.renameSheet}>
          <Text style={styles.renameTitle}>Rename list</Text>
          <TextInput
            value={renameValue}
            onChangeText={setRenameValue}
            placeholder="List name"
            placeholderTextColor={Colors.light.textLight}
            style={styles.renameInput}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleRename}
            maxLength={60}
          />
          <Pressable
            onPress={handleRename}
            disabled={renameList.isPending || !renameValue.trim()}
            style={({ pressed }) => [
              styles.renameButton,
              (renameList.isPending || !renameValue.trim()) && styles.renameButtonDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.renameButtonText}>
              {renameList.isPending ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
  iconButtonDisabled: {
    opacity: 0.4,
  },
  headerTitleWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...Typography.h4,
    color: Colors.light.text,
    flexShrink: 1,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  collectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    ...Shadows.sm,
  },
  collectPressed: {
    backgroundColor: Colors.light.buttonPrimaryPressed,
  },
  collectText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  retryButton: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  progressTrack: {
    height: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.divider,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.success,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.light.text,
    paddingVertical: 10,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 90,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  emptyBody: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
  },
  quickActionsWrap: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
  },
  renameSheet: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  renameTitle: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  renameInput: {
    ...Typography.body,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  renameButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  renameButtonDisabled: {
    opacity: 0.5,
  },
  renameButtonText: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
});
