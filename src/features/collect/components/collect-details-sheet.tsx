import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductImage } from '@/components/ui/product-image';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ImageViewer } from '@/components/ui/image-viewer';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { useCompareProduct } from '@/features/compare/hooks/use-compare-product';
import { useLists } from '@/features/lists/hooks/use-lists';
import { OUT_OF_STOCK_ID, isOutOfStockList, ordinaryListTargets } from '@/features/lists/out-of-stock';
import type { ListProduct } from '@/features/lists/types';
import { useShopPrice } from '@/features/price-reports/hooks';
import { formatSizeLabel } from '@/utils/pack-size';

interface CollectDetailsSheetProps {
  product: ListProduct | null;
  isLoading?: boolean;
  onClose: () => void;
  /** Toggle the urgent flag on this list item. */
  onToggleUrgent?: (listProductId: string) => void;
  /** Move this list item to the same product at another shop. */
  onChangeShop?: (listProductId: string, productAtShopId: string) => void;
  changingShop?: boolean;
  /** List currently being collected (excluded from the move targets). */
  listId?: string;
  /** Move this list item into another existing list. */
  onMoveToList?: (listProductId: string, targetListId: string) => void;
  /** Move this list item into Out of Stock, grouped by supplier shop. */
  onMarkOutOfStock?: (listProductId: string) => void;
  movingList?: boolean;
}

function money(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `£${Number(value).toFixed(2)}`;
}

/** Shared list-item details, with optional Collect Mode actions. */
export function CollectDetailsSheet({
  product: selectedProduct,
  isLoading,
  onClose,
  onToggleUrgent,
  onChangeShop,
  changingShop,
  listId,
  onMoveToList,
  onMarkOutOfStock,
  movingList,
}: CollectDetailsSheetProps) {
  // Retain the content during the sheet's exit animation instead of collapsing it.
  const [lastProduct, setLastProduct] = useState(selectedProduct);
  if (selectedProduct && selectedProduct !== lastProduct) setLastProduct(selectedProduct);
  const product = selectedProduct ?? lastProduct;
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { data: livePrice } = useShopPrice(
    selectedProduct?.productId ?? null,
    selectedProduct?.shopId ?? null,
  );
  // Bundle items are locked to their shop, so skip the comparison fetch for them.
  const canChangeShop = !!product && !product.bundlePromotionId && !!onChangeShop;
  const compare = useCompareProduct(canChangeShop ? product?.productId : undefined);
  const otherShops = (compare.data?.shops ?? []).filter((s) => s.shopId !== product?.shopId);

  const canMoveList =
    !!product && !product.bundlePromotionId && (!!onMoveToList || !!onMarkOutOfStock);
  const [listPickerFor, setListPickerFor] = useState<string | null>(null);
  const listPickerOpen = !!product && listPickerFor === product.id;
  const { data: allLists, isLoading: listsLoading } = useLists();
  const otherLists = ordinaryListTargets(allLists ?? [], listId);
  const sourceIsOutOfStock = listId === OUT_OF_STOCK_ID || isOutOfStockList(allLists?.find(list => list.id === listId)?.name ?? '');
  const originalList = otherLists.find(list => list.id === product?.outOfStockSourceListId);
  const closeDetails = () => {
    setPreviewUri(null);
    setListPickerFor(null);
    onClose();
  };

  if (!product) return <BottomSheet visible={false} onClose={onClose}>{null}</BottomSheet>;

  const aisle = product.aielNumber || product.locationCode;
  const lastUpdated = livePrice?.lastUpdated
    ? new Date(livePrice.lastUpdated).toLocaleDateString()
    : null;

  return (
    <BottomSheet
      visible={!!selectedProduct}
      onClose={closeDetails}
      sheetStyle={{ maxHeight: height - insets.top - Spacing.md }}
    >
      <View style={styles.fixedHeader}>
        <View style={styles.headingRow}>
          <Text style={styles.heading} accessibilityRole="header">Product details</Text>
          <Pressable
            onPress={closeDetails}
            accessibilityRole="button"
            accessibilityLabel="Close product details"
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="close" size={22} color={Colors.light.text} />
          </Pressable>
        </View>
        <View style={styles.hero}>
          <View style={styles.imageWrap}>
            <ProductImage
              img={product.img}
              barcode={product.barcode}
              style={styles.image}
              onPreview={setPreviewUri}
              accessibilityLabel={`Preview image of ${product.productName}`}
            />
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.name} numberOfLines={3}>{product.productName}</Text>
            {!!product.category && <Text style={styles.category} numberOfLines={1}>{product.category}</Text>}
          </View>
        </View>

        {canMoveList && onMarkOutOfStock && !sourceIsOutOfStock && (
          <Pressable
            onPress={() => onMarkOutOfStock(product.id)}
            disabled={movingList}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!movingList, busy: !!movingList }}
            style={({ pressed }) => [
              styles.actionRow,
              (pressed || movingList) && { opacity: 0.7 },
            ]}
          >
            <View style={[styles.actionIcon, styles.actionIconDanger]}>
              <Ionicons name="remove-circle-outline" size={18} color={Colors.light.error} />
            </View>
            <View style={styles.shopInfo}>
              <Text style={[styles.shopName, { color: Colors.light.error }]}>
                Mark as Out of Stock
              </Text>
              <Text style={styles.actionHint} numberOfLines={2}>
                Moves to Out of Stock under {product.shopName || 'Unknown Shop'} to buy later
              </Text>
            </View>
            {movingList && <ActivityIndicator size="small" color={Colors.light.error} />}
          </Pressable>
        )}
      </View>

      <ScrollView
        key={product.id}
        style={styles.scrollArea}
        bounces={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.priceCard}>
          <View style={styles.priceMain}>
            <Text style={styles.priceLabel}>Price at {product.shopName || 'shop'}</Text>
            <View style={styles.priceValueRow}>
              <Text style={styles.priceValue}>{money(livePrice?.price ?? product.lowestPrice)}</Text>
              {(livePrice?.hasActiveOffer ?? product.hasActiveOffer) && (
                <>
                  <Text style={styles.priceOriginal}>
                    {money(livePrice?.originalPrice ?? product.originalPrice)}
                  </Text>
                  <View style={styles.offerPill}>
                    <Text style={styles.offerText}>OFFER</Text>
                  </View>
                </>
              )}
            </View>
            {!!lastUpdated && (
              <Text style={styles.priceUpdated}>Price last updated {lastUpdated}</Text>
            )}
          </View>
        </View>

        {onToggleUrgent && (
          <View style={styles.urgentRow}>
            <View style={styles.urgentLabelWrap}>
              <View style={styles.urgentTitleRow}>
                <Ionicons
                  name={product.isUrgent ? 'alert-circle' : 'alert-circle-outline'}
                  size={18}
                  color={product.isUrgent ? Colors.light.error : Colors.light.textSecondary}
                />
                <Text style={styles.urgentTitle}>Urgent item</Text>
              </View>
              <Text style={styles.urgentHint}>Show first under the Urgent filter</Text>
            </View>
            <Switch
              value={!!product.isUrgent}
              onValueChange={() => onToggleUrgent(product.id)}
              trackColor={{ true: Colors.light.error }}
            />
          </View>
        )}

        <View style={styles.grid}>
          <DetailRow
            icon="cube-outline"
            label="Pack size"
            value={
              formatSizeLabel({
                title: product.productName,
                packetSize: product.packetSize,
                retailSize: product.retailSize,
              }) || '—'
            }
          />
          <DetailRow icon="barcode-outline" label="Barcode" value={product.barcode || '—'} />
          {!product.caseBarcode && isLoading ? (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="barcode-outline" size={16} color={Colors.light.primary} />
              </View>
              <Text style={styles.detailLabel}>Case barcode</Text>
              <ActivityIndicator size="small" color={Colors.light.primary} />
            </View>
          ) : (
            <DetailRow icon="barcode-outline" label="Case barcode" value={product.caseBarcode || '—'} />
          )}
          <DetailRow icon="storefront-outline" label="Shop" value={product.shopName || '—'} />
          <DetailRow icon="location-outline" label="Aisle / shelf" value={aisle ? `Aisle ${aisle}` : 'Not mapped'} />
          <DetailRow icon="layers-outline" label="Quantity to collect" value={`${product.quantity}`} />
          {product.inHandStock != null && (
            <DetailRow
              icon="file-tray-stacked-outline"
              label="In-hand stock"
              value={`${product.inHandStock}`}
            />
          )}
          <DetailRow
            icon="checkmark-done-outline"
            label="Status"
            value={product.isPurchased ? 'Collected' : 'To collect'}
          />
        </View>

        {canChangeShop && (
          <View style={styles.shopsSection}>
            <Text style={styles.shopsTitle}>Collect from another shop</Text>
            {compare.isLoading ? (
              <ActivityIndicator size="small" color={Colors.light.primary} style={styles.shopsLoading} />
            ) : otherShops.length === 0 ? (
              <Text style={styles.shopsEmpty}>Not available at any other shop.</Text>
            ) : (
              otherShops.map((shop) => (
                <View key={shop.productAtShopId} style={styles.shopRow}>
                  <View style={styles.shopInfo}>
                    <Text style={styles.shopName} numberOfLines={1}>
                      {shop.shopName}
                    </Text>
                    <Text style={styles.shopPrice}>
                      {money(shop.effectivePrice)}
                      {shop.hasActiveOffer ? '  · offer' : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onChangeShop?.(product.id, shop.productAtShopId)}
                    disabled={changingShop}
                    style={({ pressed }) => [
                      styles.moveButton,
                      (pressed || changingShop) && { opacity: 0.7 },
                    ]}
                  >
                    {changingShop ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />
                        <Text style={styles.moveButtonText}>Move</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {canMoveList && onMoveToList && (
          <View style={styles.shopsSection}>
            <Text style={styles.shopsTitle}>{sourceIsOutOfStock ? 'Return to a shopping list' : 'Move item'}</Text>
            {sourceIsOutOfStock && originalList && <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Return to ${originalList.name}`}
              disabled={movingList}
              onPress={() => onMoveToList(product.id, originalList.id)}
              style={styles.actionRow}
            >
              <Ionicons name="arrow-undo-outline" size={18} color={Colors.light.primary} />
              <View style={styles.shopInfo}>
                <Text style={styles.shopName}>Return to {originalList.name}</Text>
                <Text style={styles.actionHint}>Original shopping list</Text>
              </View>
            </Pressable>}
            {sourceIsOutOfStock && !originalList && <Text style={styles.actionHint}>
              {product.outOfStockSourceListId ? 'The original list is no longer available in your access. Choose another list.' : 'No original list was recorded for this item. Choose a destination below.'}
            </Text>}

            <Pressable
              onPress={() => setListPickerFor(listPickerOpen ? null : product.id)}
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="list-outline" size={18} color={Colors.light.primary} />
              </View>
              <View style={styles.shopInfo}>
                <Text style={styles.shopName}>Move to another list</Text>
                <Text style={styles.actionHint}>Pick one of your existing lists</Text>
              </View>
              <Ionicons
                name={listPickerOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.light.textSecondary}
              />
            </Pressable>

            {listPickerOpen &&
              (listsLoading ? (
                <ActivityIndicator size="small" color={Colors.light.primary} style={styles.shopsLoading} />
              ) : otherLists.length === 0 ? (
                <Text style={styles.shopsEmpty}>You have no other lists yet.</Text>
              ) : (
                otherLists.map((target) => (
                  <View key={target.id} style={styles.shopRow}>
                    <View style={styles.shopInfo}>
                      <Text style={styles.shopName} numberOfLines={1}>
                        {target.name}
                      </Text>
                      <Text style={styles.actionHint}>
                        {target.itemCount} item{target.itemCount === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onMoveToList(product.id, target.id)}
                      disabled={movingList}
                      style={({ pressed }) => [
                        styles.moveButton,
                        (pressed || movingList) && { opacity: 0.7 },
                      ]}
                    >
                      {movingList ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="arrow-redo" size={14} color="#FFFFFF" />
                          <Text style={styles.moveButtonText}>Move</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ))
              ))}
          </View>
        )}
      </ScrollView>
      <ImageViewer
        uri={previewUri}
        visible={!!selectedProduct && !!previewUri}
        onClose={() => setPreviewUri(null)}
        presentation="preview"
      />
    </BottomSheet>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={16} color={Colors.light.primary} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fixedHeader: {
    flexShrink: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  heading: {
    ...Typography.bodyBold,
    color: Colors.light.text,
    flex: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flexShrink: 1,
    minHeight: 0,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  imageWrap: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 74,
    height: 74,
  },
  heroInfo: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  category: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  priceCard: {
    backgroundColor: Colors.light.primaryLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  priceMain: {
    gap: 4,
  },
  priceLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  priceValue: {
    ...Typography.price,
    color: Colors.light.primary,
  },
  priceOriginal: {
    ...Typography.body,
    color: Colors.light.textLight,
    textDecorationLine: 'line-through',
  },
  offerPill: {
    backgroundColor: Colors.light.success,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  offerText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  priceUpdated: {
    ...Typography.caption,
    color: Colors.light.textLight,
  },
  grid: {
    gap: 2,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: Spacing.xs,
  },
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  urgentLabelWrap: {
    flex: 1,
    gap: 2,
  },
  urgentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  urgentTitle: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  urgentHint: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  shopsSection: {
    gap: Spacing.xs,
  },
  shopsTitle: {
    ...Typography.label,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shopsLoading: {
    marginVertical: Spacing.sm,
  },
  shopsEmpty: {
    ...Typography.bodySmall,
    color: Colors.light.textLight,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  shopInfo: {
    flex: 1,
    gap: 2,
  },
  shopName: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.text,
  },
  shopPrice: {
    ...Typography.caption,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  moveButtonText: {
    ...Typography.caption,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconDanger: {
    backgroundColor: `${Colors.light.error}1A`,
  },
  actionHint: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  detailValue: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.light.text,
    maxWidth: '55%',
  },
});
