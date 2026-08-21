import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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

import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { BundleOfferSheet } from '@/features/lists/components/bundle-offer-sheet';
import { ProductSheet } from '@/features/lists/components/product-sheet';
import { SearchResultCard } from '@/features/lists/components/search-result-card';
import { useListDetails, useUpdateQuantity } from '@/features/lists/hooks/use-list-details';
import {
  useProductSearch,
  useRecentSearches,
} from '@/features/lists/hooks/use-product-search';
import { useSmartAdd } from '@/features/lists/hooks/use-smart-add';
import type { Product } from '@/features/lists/types';

/**
 * Add products to a list: debounced backend search with recent history,
 * per-card add spinners, and a barcode scanner entry point.
 */
export default function AddProductScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

  const { data: results, isFetching, isSearchActive, isDebouncing, searchTerm } =
    useProductSearch(query);
  const { recentSearches, addRecentSearch, clearRecentSearches } = useRecentSearches();
  const { data: list } = useListDetails(listId ?? '');
  const smartAdd = useSmartAdd(listId ?? undefined);
  const updateQuantity = useUpdateQuantity(listId ?? '');

  const productIdsInList = useMemo(
    () => new Set((list?.products ?? []).map((p) => p.productId)),
    [list?.products],
  );

  // listProduct row per productId so the card stepper can adjust quantity in place.
  const listProductByProductId = useMemo(() => {
    const map = new Map<string, { id: string; quantity: number }>();
    for (const p of list?.products ?? []) {
      if (!p.id.startsWith('optimistic-')) map.set(p.productId, { id: p.id, quantity: p.quantity });
    }
    return map;
  }, [list?.products]);

  const handleAdd = async (
    product: Product,
    quantity = 1,
    options?: { isUrgent?: boolean; inHandStock?: number },
  ) => {
    if (!listId) return;
    addRecentSearch(searchTerm);
    setAddingIds((prev) => new Set(prev).add(product.id));
    try {
      // Bundle-aware add: shows the bundle offer sheet when applicable,
      // otherwise adds directly (toasts handled inside the hook). The delay
      // lets the product details sheet finish dismissing before the bundle
      // sheet presents — iOS won't present a modal while another is closing.
      await smartAdd.requestAdd(product, quantity, { presentDelayMs: 350, ...options });
    } catch (error: any) {
      showToast(error?.message ?? 'Failed to add product', 'error');
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const showRecent = !isSearchActive && recentSearches.length > 0;
  const showResultsLoading = isSearchActive && (isFetching || isDebouncing) && !results?.length;
  const showNoResults =
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
          <Text style={styles.title}>Add Products</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.light.textLight} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search products by name or barcode"
            placeholderTextColor={Colors.light.textLight}
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => addRecentSearch(query)}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.light.textLight} />
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() => {
            router.back();
            router.push({ pathname: '/(app)/scanner', params: { listId: listId ?? '' } });
          }}
          style={({ pressed }) => [styles.scanRow, pressed && styles.scanRowPressed]}
        >
          <View style={styles.scanIcon}>
            <Ionicons name="scan" size={20} color={Colors.light.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanTitle}>Scan barcode</Text>
            <Text style={styles.scanSubtitle}>Point your camera at a product barcode</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.light.textLight} />
        </Pressable>
      </View>

      {showRecent && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent searches</Text>
            <Pressable onPress={clearRecentSearches} hitSlop={8}>
              <Text style={styles.recentClear}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.recentChips}>
            {recentSearches.map((term) => (
              <Pressable
                key={term}
                onPress={() => setQuery(term)}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Ionicons name="time-outline" size={14} color={Colors.light.textSecondary} />
                <Text style={styles.chipText}>{term}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {showResultsLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.light.primary} />
          <Text style={styles.centerText}>Searching…</Text>
        </View>
      ) : showNoResults ? (
        <View style={styles.centerState}>
          <Ionicons name="search-outline" size={36} color={Colors.light.textLight} />
          <Text style={styles.centerText}>No products found for “{searchTerm}”</Text>
        </View>
      ) : (
        <FlatList
          data={isSearchActive ? results ?? [] : []}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const inListEntry = listProductByProductId.get(item.id);
            return (
              <Animated.View entering={FadeInDown.duration(250).delay(Math.min(index, 8) * 30)}>
                <SearchResultCard
                  product={item}
                  onPress={() => setSelectedProduct(item)}
                  onAdd={() => handleAdd(item)}
                  isAdding={addingIds.has(item.id)}
                  inList={productIdsInList.has(item.id)}
                  quantityInList={inListEntry?.quantity}
                  onQuantityChange={(quantity) =>
                    inListEntry &&
                    updateQuantity.mutate(
                      { listProductId: inListEntry.id, quantity },
                      { onError: (error) => showToast(error.message, 'error') },
                    )
                  }
                />
              </Animated.View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}

      <ProductSheet
        product={selectedProduct}
        visible={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        inList={!!selectedProduct && productIdsInList.has(selectedProduct.id)}
        onAdd={(product, quantity, options) => {
          setSelectedProduct(null);
          handleAdd(product, quantity, options);
        }}
      />

      <BundleOfferSheet
        prompt={smartAdd.bundlePrompt}
        claiming={smartAdd.isClaiming}
        onAddBundle={smartAdd.addBundleFromPrompt}
        onAddSingle={smartAdd.addSingleFromPrompt}
        onClose={smartAdd.dismissBundle}
      />
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
  iconButtonPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  title: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.light.text,
    paddingVertical: 12,
  },
  scanRow: {
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
  scanRowPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  scanIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.text,
  },
  scanSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  recentSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    gap: Spacing.sm,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentTitle: {
    ...Typography.label,
    color: Colors.light.textSecondary,
  },
  recentClear: {
    ...Typography.caption,
    color: Colors.light.primary,
    fontWeight: '700',
  },
  recentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  chipPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  chipText: {
    ...Typography.caption,
    color: Colors.light.text,
    fontWeight: '600',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  centerText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxl,
  },
});
