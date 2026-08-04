import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { useLists } from '@/features/lists/hooks/use-lists';
import type { ShoppingList } from '@/features/lists/types';

interface ListPickerSheetProps {
  visible: boolean;
  /** Name of the product being added, shown in the header. */
  productName?: string | null;
  /** ID of the list currently being added to — shows a spinner on that row. */
  loadingListId?: string | null;
  onSelect: (list: ShoppingList) => void;
  onClose: () => void;
}

/** Bottom sheet to choose which shopping list a product should be added to. */
export function ListPickerSheet({ visible, productName, loadingListId, onSelect, onClose }: ListPickerSheetProps) {
  const { data: lists, isLoading } = useLists();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Add to list</Text>
      {!!productName && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {productName}
        </Text>
      )}

      {isLoading && !lists ? (
        <ActivityIndicator color={Colors.light.primary} style={styles.loader} />
      ) : !lists || lists.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="clipboard-outline" size={28} color={Colors.light.textLight} />
          <Text style={styles.emptyText}>
            You have no lists yet. Create one from the Lists tab first.
          </Text>
        </View>
      ) : (
        <View style={styles.listWrap}>
          {lists.slice(0, 8).map((list) => (
            <Pressable
              key={list.id}
              onPress={() => loadingListId == null && onSelect(list)}
              disabled={loadingListId != null}
              style={({ pressed }) => [
                styles.row,
                pressed && loadingListId == null && styles.rowPressed,
                loadingListId === list.id && styles.rowLoading,
              ]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="cart-outline" size={18} color={Colors.light.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {list.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {list.itemCount ?? 0} {list.itemCount === 1 ? 'item' : 'items'}
                </Text>
              </View>
              {loadingListId === list.id ? (
                <ActivityIndicator size="small" color={Colors.light.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={Colors.light.textLight} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    ...Typography.h4,
    color: Colors.light.text,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  loader: {
    marginVertical: Spacing.xl,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  listWrap: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundCard,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  rowPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  rowLoading: {
    opacity: 0.75,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  rowName: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.text,
  },
  rowMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
});
