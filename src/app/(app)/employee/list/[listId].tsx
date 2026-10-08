import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { SizeBadge } from '@/components/ui/size-badge';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { useListDetails } from '@/features/lists/hooks/use-list-details';
import { useTrackList } from '@/features/lists/hooks/use-lists';
import type { ListProduct } from '@/features/lists/types';
import { usePullToRefresh, useRefetchOnFocus } from '@/hooks/use-query-refresh';
import { formatSizeLabel } from '@/utils/pack-size';
import { getProductImageUrl } from '@/utils/product-image';
import { matchesSearch } from '@/utils/search';

/**
 * Shop owner's view of an employee's list: the products they added, live.
 * "Copy to my lists" puts the same list (same name, marked with who it came from)
 * into the owner's lists; items the employee adds later show up there instantly.
 */
export default function EmployeeListScreen() {
  const { listId: rawId } = useLocalSearchParams<{ listId: string }>();
  const listId = rawId ?? '';
  const router = useRouter();
  const { showToast } = useToast();

  const { data: list, isError, error, fetchStatus, refetch } = useListDetails(listId);
  const { refreshing, onRefresh } = usePullToRefresh(refetch, fetchStatus);
  useRefetchOnFocus(refetch);
  const trackList = useTrackList();
  const [filter, setFilter] = useState('');

  const products = useMemo(() => {
    const all = list?.products ?? [];
    const term = filter.trim();
    return term ? all.filter((p) => matchesSearch(term, p.productName, p.barcode, p.category)) : all;
  }, [list?.products, filter]);
  const total = list?.products?.length ?? 0;
  const collected = list?.products?.filter((p) => p.isPurchased).length ?? 0;
  const creator = list?.createdByName ?? 'this employee';

  const copy = () =>
    trackList.mutate(listId, {
      onSuccess: () => showToast(`“${list?.name}” is now in your lists`, 'success'),
      onError: (err: any) => {
        if (!err?.silent) showToast(err?.message ?? 'Could not copy this list', 'error');
      },
    });

  const banner = list ? (
    list.copiedByMe ? (
      <View style={[styles.banner, styles.bannerDone]}>
        <View style={styles.bannerRow}>
          <Ionicons name="sync" size={18} color={Colors.light.success} />
          <Text style={styles.bannerTitle}>In your lists · live</Text>
        </View>
        <Text style={styles.bannerBody}>
          Shown in your lists as “{list.name}”, copied from {creator}. Anything {creator} adds appears there instantly.
        </Text>
        <PrimaryButton title="Open in my lists" onPress={() => router.push(`/list/${listId}` as Href)} />
      </View>
    ) : (
      <View style={styles.banner}>
        <View style={styles.bannerRow}>
          <Ionicons name="copy-outline" size={18} color={Colors.light.primary} />
          <Text style={styles.bannerTitle}>Copy to my lists</Text>
        </View>
        <Text style={styles.bannerBody}>
          Adds “{list.name}” to your lists, marked as copied from {creator}. It stays in sync: new items {creator} adds
          appear in your copy instantly.
        </Text>
        <PrimaryButton title="Copy to my lists" onPress={copy} loading={trackList.isPending} />
      </View>
    )
  ) : null;

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
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>
              {list?.name ?? 'List'}
            </Text>
            <View style={styles.subtitleRow}>
              <View style={styles.liveDot} />
              <Text style={styles.subtitle} numberOfLines={1}>
                By {creator} · {total} {total === 1 ? 'item' : 'items'}
                {collected > 0 ? ` · ${collected} collected` : ''}
              </Text>
            </View>
          </View>
        </View>
        {total > 0 && (
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
        )}
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReadOnlyProductRow item={item} />}
        ListHeaderComponent={banner}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />
        }
        ListEmptyComponent={
          !list && fetchStatus === 'fetching' ? null : (
            <View style={styles.empty}>
              <Ionicons
                name={isError && !list ? 'alert-circle-outline' : 'basket-outline'}
                size={36}
                color={Colors.light.textLight}
              />
              <Text style={styles.emptyTitle}>
                {isError && !list ? 'Couldn’t load this list' : filter ? 'Nothing matches' : 'No products yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {isError && !list
                  ? error?.message
                  : filter
                    ? 'Try a different product name or barcode.'
                    : `Products ${creator} adds show up here instantly.`}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function ReadOnlyProductRow({ item }: { item: ListProduct }) {
  const imageUrl = getProductImageUrl(item.img, item.barcode);
  const price = item.hasActiveOffer && item.offerPrice != null ? item.offerPrice : item.lowestPrice;
  return (
    <View style={[styles.row, item.isPurchased && styles.rowCollected]}>
      <View style={styles.imageWrapper}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" transition={150} />
        ) : (
          <Ionicons name="cube-outline" size={22} color={Colors.light.textLight} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={styles.nameRow}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.productName}
          </Text>
          <SizeBadge
            label={formatSizeLabel({ title: item.productName, packetSize: item.packetSize, retailSize: item.retailSize })}
          />
        </View>
        <Text style={styles.productMeta} numberOfLines={1}>
          £{price.toFixed(2)} · {item.shopName}
        </Text>
        {(item.isUrgent || item.isPurchased) && (
          <View style={styles.badgeRow}>
            {item.isUrgent && <Text style={[styles.badge, styles.badgeUrgent]}>URGENT</Text>}
            {item.isPurchased && <Text style={[styles.badge, styles.badgeCollected]}>COLLECTED</Text>}
          </View>
        )}
      </View>
      <Text style={styles.qty}>×{item.quantity}</Text>
    </View>
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
  title: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.light.success,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    flexShrink: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 42,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.light.text,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  banner: {
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
  },
  bannerDone: {
    borderColor: Colors.light.success,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bannerTitle: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  bannerBody: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  rowCollected: {
    opacity: 0.65,
  },
  imageWrapper: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  productName: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.light.text,
    flexShrink: 1,
  },
  productMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    color: '#FFFFFF',
  },
  badgeUrgent: {
    backgroundColor: Colors.light.error,
  },
  badgeCollected: {
    backgroundColor: Colors.light.success,
  },
  qty: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  emptyBody: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
