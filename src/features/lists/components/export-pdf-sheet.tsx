import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { matchesSearch } from '@/utils/search';

import type { ListProduct } from '../types';

export interface ExportShopOption {
  shopId: string;
  shopName: string;
  productCount: number;
}

interface ExportPdfSheetProps {
  visible: boolean;
  products: ListProduct[];
  exporting?: boolean;
  onClose: () => void;
  onExport: (options: { barcodeShopId: string | null }) => void;
}

/**
 * Export Options dialog for the printable picking sheet. Printable barcodes
 * are opt-in and generated for one selected shop only, to keep the PDF light
 * and the paper usage minimal.
 */
export function ExportPdfSheet({ visible, products, exporting, onClose, onExport }: ExportPdfSheetProps) {
  const [includeBarcodes, setIncludeBarcodes] = useState(false);
  const [shopQuery, setShopQuery] = useState('');
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setIncludeBarcodes(false);
      setShopQuery('');
      setSelectedShopId(null);
    }
  }, [visible]);

  const shops = useMemo<ExportShopOption[]>(() => {
    const map = new Map<string, ExportShopOption>();
    for (const p of products) {
      const id = p.shopId || 'unknown';
      const entry = map.get(id) ?? {
        shopId: id,
        shopName: p.shopName || 'Unknown shop',
        productCount: 0,
      };
      entry.productCount += 1;
      map.set(id, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.productCount - a.productCount);
  }, [products]);

  const filteredShops = useMemo(() => {
    const term = shopQuery.trim();
    return term ? shops.filter((s) => matchesSearch(term, s.shopName)) : shops;
  }, [shops, shopQuery]);

  const canExport = !includeBarcodes || !!selectedShopId;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware scrollable>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="document-text" size={22} color={Colors.light.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Export PDF</Text>
            <Text style={styles.subtitle}>
              A4 picking sheet · grouped by shop, aisle and category
            </Text>
          </View>
        </View>

        <View style={styles.optionCard}>
          <Pressable
            style={styles.optionRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setIncludeBarcodes((v) => !v);
            }}
          >
            <View style={styles.optionIcon}>
              <Ionicons name="barcode-outline" size={20} color={Colors.light.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Include Printable Barcodes</Text>
              <Text style={styles.optionBody}>
                Scannable barcode images for one shop&apos;s products
              </Text>
            </View>
            <Switch
              value={includeBarcodes}
              onValueChange={(v) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setIncludeBarcodes(v);
              }}
              trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
              thumbColor="#FFFFFF"
            />
          </Pressable>

          {includeBarcodes && (
            <Animated.View entering={FadeInDown.duration(220)} style={styles.shopPicker}>
              <Text style={styles.pickerLabel}>Print barcodes for which shop?</Text>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={16} color={Colors.light.textLight} />
                <TextInput
                  value={shopQuery}
                  onChangeText={setShopQuery}
                  placeholder="Search shops in this list"
                  placeholderTextColor={Colors.light.textLight}
                  style={styles.searchInput}
                />
                {shopQuery.length > 0 && (
                  <Pressable onPress={() => setShopQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={Colors.light.textLight} />
                  </Pressable>
                )}
              </View>

              <View style={styles.shopList}>
                {filteredShops.length === 0 && (
                  <Text style={styles.noShops}>No shops match your search</Text>
                )}
                {filteredShops.map((shop) => {
                  const selected = shop.shopId === selectedShopId;
                  return (
                    <Pressable
                      key={shop.shopId}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setSelectedShopId(selected ? null : shop.shopId);
                      }}
                      style={[styles.shopRow, selected && styles.shopRowSelected]}
                    >
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                      <Text
                        style={[styles.shopName, selected && styles.shopNameSelected]}
                        numberOfLines={1}
                      >
                        {shop.shopName}
                      </Text>
                      <Text style={styles.shopCount}>
                        {shop.productCount} {shop.productCount === 1 ? 'item' : 'items'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {!selectedShopId && (
                <Animated.Text entering={FadeIn.duration(180)} style={styles.hint}>
                  Select a shop to continue
                </Animated.Text>
              )}
            </Animated.View>
          )}
        </View>

        <PrimaryButton
          title={exporting ? 'Preparing PDF…' : 'Export PDF'}
          onPress={() => onExport({ barcodeShopId: includeBarcodes ? selectedShopId : null })}
          loading={exporting}
          disabled={!canExport}
        />
        <PrimaryButton title="Cancel" variant="ghost" onPress={onClose} disabled={exporting} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  optionCard: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: 1,
  },
  optionTitle: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.light.text,
  },
  optionBody: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  shopPicker: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: Spacing.sm,
  },
  pickerLabel: {
    ...Typography.label,
    color: Colors.light.textSecondary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    height: 38,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySmall,
    color: Colors.light.text,
    paddingVertical: 0,
  },
  shopList: {
    gap: 4,
    maxHeight: 190,
  },
  noShops: {
    ...Typography.caption,
    color: Colors.light.textLight,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  shopRowSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryLight,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.light.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.light.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primary,
  },
  shopName: {
    flex: 1,
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.text,
  },
  shopNameSelected: {
    color: Colors.light.primary,
  },
  shopCount: {
    ...Typography.caption,
    color: Colors.light.textLight,
  },
  hint: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
