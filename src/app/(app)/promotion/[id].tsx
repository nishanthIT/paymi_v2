import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SizeBadge } from '@/components/ui/size-badge';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { usePromotions } from '@/features/home/hooks/use-home';
import { ListPickerSheet } from '@/features/home/components/list-picker-sheet';
import type { PromotionProduct } from '@/features/home/types';
import * as listApi from '@/features/lists/api';
import { listKeys } from '@/features/lists/keys';
import type { ShoppingList } from '@/features/lists/types';
import { formatSizeLabel } from '@/utils/pack-size';
import { getProductImageUrl } from '@/utils/product-image';

const toNumber = (value: number | string | null): number | null => {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

/** All products inside a promotion with per-product Add to List. */
export default function PromotionProductsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: promotions } = usePromotions();
  const promotion = useMemo(
    () => promotions?.find((p) => p.id === id) ?? null,
    [promotions, id],
  );

  // Product currently choosing a list, and per-product "added" state.
  const [pickingFor, setPickingFor] = useState<PromotionProduct | null>(null);
  const [addedTo, setAddedTo] = useState<Record<string, string>>({});
  const [loadingListId, setLoadingListId] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (input: { listId: string; productId: string }) =>
      listApi.addProductToList(input),
  });

  const handleSelectList = (list: ShoppingList) => {
    const product = pickingFor;
    if (!product || loadingListId != null) return;

    setLoadingListId(list.id);
    addMutation.mutate(
      { listId: list.id, productId: product.id },
      {
        onSuccess: () => {
          setAddedTo((prev) => ({ ...prev, [product.id]: list.name }));
          showToast(`Added to ${list.name}`, 'success');
          queryClient.invalidateQueries({ queryKey: listKeys.detail(list.id) });
          queryClient.invalidateQueries({ queryKey: listKeys.all });
        },
        onError: () => showToast('Could not add the product. Try again.', 'error'),
        onSettled: () => {
          setLoadingListId(null);
          setPickingFor(null);
        },
      },
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {promotion?.title ?? 'Promotion'}
          </Text>
          {!!promotion?.shop?.name && (
            <Text style={styles.headerMeta} numberOfLines={1}>
              {promotion.shop.name}
            </Text>
          )}
        </View>
      </View>

      <FlatList
        data={promotion?.products ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        initialNumToRender={8}
        windowSize={7}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.duration(280).delay(Math.min(index * 40, 320))}>
            <ProductRow
              product={item}
              addedToList={addedTo[item.id] ?? null}
              adding={addMutation.isPending && pickingFor?.id === item.id}
              onAdd={() => setPickingFor(item)}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="pricetags-outline" size={36} color={Colors.light.textLight} />
            <Text style={styles.emptyText}>No products in this promotion.</Text>
          </View>
        }
      />

      <ListPickerSheet
        visible={!!pickingFor}
        productName={pickingFor?.title}
        loadingListId={loadingListId}
        onSelect={handleSelectList}
        onClose={() => loadingListId == null && setPickingFor(null)}
      />
    </SafeAreaView>
  );
}

function ProductRow({
  product,
  addedToList,
  adding,
  onAdd,
}: {
  product: PromotionProduct;
  addedToList: string | null;
  adding: boolean;
  onAdd: () => void;
}) {
  const imageUrl = getProductImageUrl(product.img as any, product.barcode);
  const sizeLabel = formatSizeLabel({ title: product.title });

  const price = toNumber(product.price);
  const offerPrice = toNumber(product.offerPrice);
  const rrp = toNumber(product.rrp);

  // Promo price = shop offer price when set, else shop price.
  const promoPrice = offerPrice ?? price;
  const originalPrice = offerPrice != null ? price : rrp;
  const savings =
    promoPrice != null && originalPrice != null && originalPrice > promoPrice
      ? originalPrice - promoPrice
      : null;

  return (
    <View style={styles.row}>
      <View style={styles.thumbWrap}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumb}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={product.id}
            transition={180}
          />
        ) : (
          <Ionicons name="cube-outline" size={24} color={Colors.light.textLight} />
        )}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={2}>
            {product.title}
          </Text>
          <SizeBadge label={sizeLabel} />
        </View>
        <View style={styles.priceRow}>
          {promoPrice != null && (
            <Text style={styles.promoPrice}>£{promoPrice.toFixed(2)}</Text>
          )}
          {originalPrice != null && savings != null && (
            <Text style={styles.originalPrice}>£{originalPrice.toFixed(2)}</Text>
          )}
          {savings != null && (
            <View style={styles.savePill}>
              <Text style={styles.saveText}>Save £{savings.toFixed(2)}</Text>
            </View>
          )}
        </View>
        {!!addedToList && (
          <Text style={styles.addedText} numberOfLines={1}>
            In “{addedToList}”
          </Text>
        )}
      </View>

      {addedToList ? (
        <Animated.View entering={ZoomIn.duration(220)} style={styles.addedBadge}>
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
        </Animated.View>
      ) : (
        <Pressable
          onPress={onAdd}
          disabled={adding}
          hitSlop={8}
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  headerMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  row: {
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
  thumbWrap: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.text,
    flexShrink: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  promoPrice: {
    ...Typography.bodyBold,
    fontSize: 15,
    color: Colors.light.primary,
  },
  originalPrice: {
    ...Typography.caption,
    color: Colors.light.textLight,
    textDecorationLine: 'line-through',
  },
  savePill: {
    backgroundColor: Colors.light.success,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  saveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  addedText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.success,
    fontWeight: '600',
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  addedBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.light.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
});
