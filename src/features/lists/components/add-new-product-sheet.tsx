import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { matchesSearch } from '@/utils/search';

import { useCategories } from '../hooks/use-product-search';

interface AddNewProductSheetProps {
  visible: boolean;
  barcode: string;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    retailSize: string;
    category: string;
    inHandStock?: number;
  }) => void;
  submitting?: boolean;
}

/**
 * Shown instead of an error when a scanned barcode has no matching product.
 * Submits to the existing quick-add endpoint — the product then appears in
 * Admin → New Products for review/approval.
 */
export function AddNewProductSheet({
  visible,
  barcode,
  onClose,
  onSubmit,
  submitting,
}: AddNewProductSheetProps) {
  const [title, setTitle] = useState('');
  const [retailSize, setRetailSize] = useState('');
  const [category, setCategory] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [trackStock, setTrackStock] = useState(false);
  const [stockText, setStockText] = useState('');

  const { data: categories = [], isLoading: loadingCategories } = useCategories(visible);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setRetailSize('');
      setCategory('');
      setCategoryQuery('');
      setCategoryOpen(false);
      setTrackStock(false);
      setStockText('');
    }
  }, [visible, barcode]);

  // Show the full list again when the query is just the selected value.
  const filteredCategories = useMemo(() => {
    const term = categoryQuery.trim() === category.trim() ? '' : categoryQuery;
    return categories.filter((name) => matchesSearch(term, name));
  }, [categories, categoryQuery, category]);

  const selectCategory = (name: string) => {
    setCategory(name);
    setCategoryQuery(name);
    setCategoryOpen(false);
  };

  const clearCategory = () => {
    setCategory('');
    setCategoryQuery('');
  };

  const stockQuantity = Number(stockText);
  const stockValid = !trackStock || (Number.isInteger(stockQuantity) && stockQuantity >= 0 && stockText.trim() !== '');
  const canSubmit = title.trim().length > 1 && stockValid && !submitting;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware scrollable>
      <View style={styles.headerIcon}>
        <Ionicons name="pricetag-outline" size={26} color={Colors.light.primary} />
      </View>
      <Text style={styles.title}>Add New Product</Text>
      <Text style={styles.subtitle}>
        This barcode isn’t in our catalogue yet. Add the basics below and our team will
        review and approve it.
      </Text>

      <Text style={styles.label}>Barcode</Text>
      <View style={styles.barcodeField}>
        <Ionicons name="barcode-outline" size={18} color={Colors.light.textSecondary} />
        <Text style={styles.barcodeText} numberOfLines={1}>
          {barcode}
        </Text>
        <View style={styles.readOnlyBadge}>
          <Text style={styles.readOnlyBadgeText}>Read-only</Text>
        </View>
      </View>

      <Text style={styles.label}>Product Name *</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Coca-Cola 330ml Can"
        placeholderTextColor={Colors.light.textLight}
        style={styles.input}
        autoFocus
        returnKeyType="next"
      />

      <Text style={styles.label}>Pack / Size (optional)</Text>
      <TextInput
        value={retailSize}
        onChangeText={setRetailSize}
        placeholder="e.g. 330ml, 6-pack"
        placeholderTextColor={Colors.light.textLight}
        style={styles.input}
        returnKeyType="done"
      />

      <Text style={styles.label}>Category (optional)</Text>
      <View style={styles.categoryField}>
        <Ionicons name="pricetag-outline" size={18} color={Colors.light.textSecondary} />
        <TextInput
          value={categoryQuery}
          onChangeText={(text) => {
            setCategoryQuery(text);
            setCategoryOpen(true);
            // Typing something new invalidates the previous selection.
            if (category && text.trim() !== category.trim()) setCategory('');
          }}
          onFocus={() => setCategoryOpen(true)}
          placeholder="Search categories…"
          placeholderTextColor={Colors.light.textLight}
          style={styles.categoryInput}
          returnKeyType="done"
        />
        {loadingCategories ? (
          <ActivityIndicator size="small" color={Colors.light.textSecondary} />
        ) : categoryQuery ? (
          <Pressable onPress={clearCategory} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.light.textSecondary} />
          </Pressable>
        ) : (
          <Pressable onPress={() => setCategoryOpen((open) => !open)} hitSlop={8}>
            <Ionicons
              name={categoryOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Colors.light.textSecondary}
            />
          </Pressable>
        )}
      </View>
      {categoryOpen && (
        <View style={styles.dropdown}>
          <ScrollView
            style={styles.dropdownScroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {filteredCategories.length === 0 ? (
              <Text style={styles.dropdownEmpty}>
                {loadingCategories ? 'Loading categories…' : 'No matching categories'}
              </Text>
            ) : (
              filteredCategories.map((name) => {
                const selected = name === category;
                return (
                  <Pressable
                    key={name}
                    onPress={() => selectCategory(name)}
                    style={({ pressed }) => [
                      styles.dropdownOption,
                      (selected || pressed) && styles.dropdownOptionActive,
                    ]}
                  >
                    <Text
                      style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark" size={18} color={Colors.light.primary} />
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      <View style={styles.stockRow}>
        <View style={styles.stockLabelWrap}>
          <Text style={styles.label}>In-Hand Stock</Text>
          <Text style={styles.stockHint}>Record how many you currently have</Text>
        </View>
        <Switch
          value={trackStock}
          onValueChange={setTrackStock}
          trackColor={{ true: Colors.light.primary }}
        />
      </View>
      {trackStock && (
        <TextInput
          value={stockText}
          onChangeText={(text) => setStockText(text.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 24"
          placeholderTextColor={Colors.light.textLight}
          style={styles.input}
          keyboardType="number-pad"
          returnKeyType="done"
        />
      )}

      <View style={styles.actions}>
        <PrimaryButton
          title={submitting ? 'Submitting…' : 'Submit for Review'}
          onPress={() =>
            onSubmit({
              title: title.trim(),
              retailSize: retailSize.trim(),
              category: category.trim(),
              inHandStock: trackStock ? stockQuantity : undefined,
            })
          }
          disabled={!canSubmit}
          loading={submitting}
        />
        <PrimaryButton title="Cancel" variant="ghost" onPress={onClose} disabled={submitting} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  headerIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.h4,
    color: Colors.light.text,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  barcodeField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: Spacing.md,
  },
  barcodeText: {
    ...Typography.bodyBold,
    color: Colors.light.text,
    flex: 1,
  },
  readOnlyBadge: {
    backgroundColor: Colors.light.divider,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  readOnlyBadgeText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '700',
  },
  input: {
    ...Typography.body,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: Spacing.md,
  },
  categoryField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  categoryInput: {
    ...Typography.body,
    color: Colors.light.text,
    flex: 1,
    paddingVertical: 12,
  },
  dropdown: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginTop: -Spacing.md + 4,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownEmpty: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    padding: Spacing.md,
    textAlign: 'center',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.divider,
  },
  dropdownOptionActive: {
    backgroundColor: Colors.light.primaryLight,
  },
  dropdownOptionText: {
    ...Typography.body,
    color: Colors.light.text,
    flex: 1,
    marginRight: Spacing.xs,
  },
  dropdownOptionTextActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  stockLabelWrap: {
    flex: 1,
  },
  stockHint: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  actions: {
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
});
