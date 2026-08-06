import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SizeBadge } from '@/components/ui/size-badge';
import { BorderRadius, Colors, Spacing, Shadows, Typography } from '@/constants/theme';
import { useProductSearch } from '@/features/lists/hooks/use-product-search';
import type { Product } from '@/features/lists/types';
import { formatSizeLabel } from '@/utils/pack-size';
import { getProductImageUrl } from '@/utils/product-image';

/**
 * Compare Products entry screen. Two paths lead to the same comparison screen:
 * type a product name (debounced backend search) or scan a barcode. The
 * scanner reuses the shared /scanner route with `intent='compare'` so we
 * don't duplicate camera/lookup plumbing here.
 */
export default function CompareProductsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const { data: results, isFetching, isSearchActive, isDebouncing, searchTerm } =
    useProductSearch(query);

  const openComparison = (productId: string) => {
    router.push({ pathname: '/(app)/compare/[productId]', params: { productId } });
  };

  const openScanner = () =>
    router.push({ pathname: '/(app)/scanner', params: { intent: 'compare' } });

  const showLoading = isSearchActive && (isFetching || isDebouncing) && !results?.length;
  const showEmpty =
    isSearchActive && !isFetching && !isDebouncing && (results?.length ?? 0) === 0;

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
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Compare Products</Text>
            <Text style={styles.subtitle}>Find the cheapest shop for any product</Text>
          </View>
        </View>

        {/* Search and scan share one row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.light.textLight} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search product name…"
              placeholderTextColor={Colors.light.textLight}
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={Colors.light.textLight} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={openScanner}
            hitSlop={4}
            style={({ pressed }) => [styles.scanButton, pressed && styles.scanButtonPressed]}
          >
            <Ionicons name="barcode-outline" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {!isSearchActive ? (
        <View style={styles.hint}>
          <View style={styles.hintIcon}>
            <Ionicons name="git-compare-outline" size={34} color={Colors.light.primary} />
          </View>
          <Text style={styles.hintTitle}>Compare prices across shops</Text>
          <Text style={styles.hintBody}>
            Search a product above, or tap the scan button to use your camera.
          </Text>
          <Pressable
            onPress={openScanner}
            style={({ pressed }) => [styles.hintScanCta, pressed && styles.hintScanCtaPressed]}
          >
            <Ionicons name="scan" size={18} color={Colors.light.primary} />
            <Text style={styles.hintScanText}>Scan a barcode</Text>
          </Pressable>
        </View>
      ) : showLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.light.primary} />
          <Text style={styles.centerText}>Searching…</Text>
        </View>
      ) : showEmpty ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={36} color={Colors.light.textLight} />
          <Text style={styles.centerText}>No products found for “{searchTerm}”</Text>
        </View>
      ) : (
        <FlatList
          data={results ?? []}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 8) * 25)}>
              <SearchRow product={item} onPress={() => openComparison(item.id)} />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}
    </SafeAreaView>
  );
}

const SearchRow = React.memo(function SearchRow({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}) {
  const imageUrl = getProductImageUrl(product.img as any, product.barcode);
  const price =
    product.lowestPrice != null && Number.isFinite(Number(product.lowestPrice))
      ? `from £${Number(product.lowestPrice).toFixed(2)}`
      : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowImageWrap}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.rowImage}
            contentFit="contain"
            transition={150}
          />
        ) : (
          <Ionicons name="cube-outline" size={24} color={Colors.light.textLight} />
        )}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {product.title}
          </Text>
          <SizeBadge label={formatSizeLabel(product)} />
        </View>
        <View style={styles.rowMetaRow}>
          {price && <Text style={styles.rowPrice}>{price}</Text>}
          {product.availableInShops != null && (
            <Text style={styles.rowMeta}>
              {product.availableInShops} shop{product.availableInShops === 1 ? '' : 's'}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rowCta}>
        <Ionicons name="git-compare-outline" size={18} color="#FFFFFF" />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  title: { ...Typography.h4, color: Colors.light.text },
  subtitle: { ...Typography.caption, color: Colors.light.textSecondary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    paddingHorizontal: Spacing.md,
    height: 50,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.light.text,
    paddingVertical: 0,
  },
  scanButton: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  scanButtonPressed: { opacity: 0.85 },
  hint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  hintIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  hintTitle: { ...Typography.h4, color: Colors.light.text, textAlign: 'center' },
  hintBody: { ...Typography.body, color: Colors.light.textSecondary, textAlign: 'center' },
  hintScanCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
  },
  hintScanCtaPressed: { backgroundColor: Colors.light.primaryLight },
  hintScanText: { ...Typography.bodyBold, color: Colors.light.primary },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  centerText: { ...Typography.body, color: Colors.light.textSecondary },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
  },
  rowPressed: { backgroundColor: Colors.light.backgroundSecondary },
  rowImageWrap: {
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
  rowImage: { width: '100%', height: '100%' },
  rowBody: { flex: 1, gap: 3 },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  rowTitle: { ...Typography.bodyBold, color: Colors.light.text, flex: 1 },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowPrice: { ...Typography.bodySmall, color: Colors.light.primary, fontWeight: '700' },
  rowMeta: { ...Typography.caption, color: Colors.light.textSecondary },
  rowCta: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
