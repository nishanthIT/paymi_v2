import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/ui/text-field';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchAgeRecordCategories, searchAgeRecordProducts } from './api';
import { categoryOptions } from './categories';

export function ProductCategoryFields({ category, product, onCategory, onProduct }: {
  category: string;
  product: string;
  onCategory: (value: string) => void;
  onProduct: (value: string) => void;
}) {
  const { activeSupermarket } = useAuth();
  const [open, setOpen] = useState<'category' | 'product' | null>(null);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const debouncedQuery = useDebouncedValue(productQuery, 300);
  const categories = useQuery({
    queryKey: ['age-restriction-records', 'categories', activeSupermarket?.id],
    queryFn: fetchAgeRecordCategories,
    staleTime: 30_000,
  });
  const products = useQuery({
    queryKey: ['age-record-products', activeSupermarket?.id, category, debouncedQuery],
    queryFn: () => searchAgeRecordProducts({ q: debouncedQuery, category: category || undefined }),
    enabled: open === 'product',
    staleTime: 30_000,
  });
  const options = categoryOptions(categories.data ?? [], category, categoryQuery);
  const chooseCategory = (value: string) => { onCategory(value); setOpen(null); setCategoryQuery(''); };
  const chooseProduct = (value: string, productCategory?: string | null) => {
    onProduct(value);
    if (!category && productCategory && productCategory !== 'USER_SUBMITTED_PENDING') onCategory(productCategory);
    setOpen(null);
    setProductQuery('');
  };
  const picker = (kind: 'category' | 'product', label: string, value: string, placeholder: string) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.picker} accessibilityRole="button" accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityHint="Opens search and available choices"
        accessibilityState={{ expanded: open === kind }} onPress={() => setOpen(open === kind ? null : kind)}>
        <Text style={[styles.pickerText, !value && styles.muted]}>{value || placeholder}</Text>
        <Ionicons name={open === kind ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.light.textSecondary} />
      </Pressable>
    </View>
  );
  const option = (label: string, onPress: () => void, icon?: 'add' | 'close') => (
    <Pressable key={label} style={styles.option} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {icon && <Ionicons name={icon} size={18} color={Colors.light.primary} />}
      <Text style={styles.optionText}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.fields}>
      {picker('category', 'Category (optional)', category, 'Select or search categories')}
      {open === 'category' && (
        <View style={styles.panel}>
          <TextField label="Search categories" value={categoryQuery} onChangeText={setCategoryQuery} maxLength={200} placeholder="e.g. Alcohol" />
          {categories.isLoading && <ActivityIndicator color={Colors.light.primary} />}
          {categories.isError && <Text style={styles.error}>{(categories.error as Error).message}</Text>}
          {categories.isError && option('Retry categories', () => { void categories.refetch(); })}
          {options.matches.slice(0, 12).map(name => option(name, () => chooseCategory(name)))}
          {options.matches.length > 12 && <Text style={styles.hint}>Type to narrow the categories.</Text>}
          {options.canAdd && option(`Use new category “${categoryQuery.trim()}”`, () => chooseCategory(categoryQuery.trim()), 'add')}
          {options.canAdd && <Text style={styles.hint}>New categories become available for this shop when you save the record.</Text>}
          {!!category && option('Clear category', () => chooseCategory(''), 'close')}
        </View>
      )}
      {picker('product', 'Product (optional)', product, 'Select or search products')}
      {open === 'product' && (
        <View style={styles.panel}>
          <TextField label="Search products" value={productQuery} onChangeText={setProductQuery} maxLength={200} placeholder="Product name or barcode" />
          {products.isFetching && <ActivityIndicator color={Colors.light.primary} />}
          {products.isError && <Text style={styles.error}>{(products.error as Error).message}</Text>}
          {products.isError && option('Retry products', () => { void products.refetch(); })}
          {products.data?.products.map(item => (
            <Pressable key={item.id} accessibilityRole="button" style={styles.option} onPress={() => chooseProduct(item.title, item.category)}>
              <View style={styles.productText}>
                <Text style={styles.optionText}>{item.title}</Text>
                {!!item.barcode && <Text style={styles.hint}>{item.barcode}</Text>}
              </View>
            </Pressable>
          ))}
          {products.data?.hasMore && <Text style={styles.hint}>Showing the first 30 matches. Refine your search to find another product.</Text>}
          {products.data?.products.length === 0 && <Text style={styles.hint}>No matching products{category ? ` in ${category}` : ''}. Search another name or record a product name below.</Text>}
          {!!productQuery.trim() && option(`Use product name “${productQuery.trim()}”`, () => chooseProduct(productQuery.trim()), 'add')}
          {!!product && option('Clear product', () => chooseProduct(''), 'close')}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: Spacing.sm },
  label: { ...Typography.label, color: Colors.light.textSecondary, marginBottom: Spacing.xs + 2 },
  picker: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', minHeight: 54, borderWidth: 1.5, borderColor: Colors.light.border, backgroundColor: Colors.light.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.md },
  pickerText: { ...Typography.body, color: Colors.light.text, flex: 1 },
  muted: { color: Colors.light.textLight },
  panel: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: BorderRadius.md, padding: Spacing.sm },
  option: { minHeight: 44, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  optionText: { ...Typography.body, color: Colors.light.text, flexShrink: 1 },
  productText: { flex: 1 },
  hint: { ...Typography.caption, color: Colors.light.textSecondary, paddingVertical: 4 },
  error: { ...Typography.caption, color: Colors.light.error },
});
