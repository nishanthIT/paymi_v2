import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useShopFeature } from '@/features/employees/permissions';
import { ListCard } from './list-card';
import { useLists } from '../hooks/use-lists';
import { outOfStockSources } from '../out-of-stock';
import { useListRemoval } from '../hooks/use-list-removal';

export function OriginalListsSheet({ visible, onClose, mode = 'manage' }: { visible: boolean; onClose: () => void; mode?: 'manage' | 'remove' }) {
  const router = useRouter();
  const { data, isError, isPending, refetch } = useLists();
  const canEdit = useShopFeature('feature.lists', 'edit');
  const removal = useListRemoval();
  const sources = outOfStockSources(data ?? []);
  return <BottomSheet visible={visible} onClose={onClose} scrollable>
    <View style={styles.sources}>
      <Text style={styles.emptyTitle}>{mode === 'remove' ? 'Choose a list to remove' : 'Original lists'}</Text>
      <Text style={styles.subtitle}>{mode === 'remove' ? 'Out of Stock includes these existing lists. Choose one to delete, or remove a shared list from your view.' : 'Open an original list to rename, share or manage its items. Empty lists remain here.'}</Text>
      {isError && <Pressable onPress={() => refetch()} accessibilityRole="button"><Text style={styles.link}>Couldn’t refresh lists. Try again.</Text></Pressable>}
      {sources.map(list => <ListCard key={list.id} list={list}
        onPress={() => {
          if (mode === 'remove') { if (canEdit && !removal.isPending) removal.confirm(list); return; }
          onClose(); router.push({ pathname: '/(app)/list/[id]', params: { id: list.id } });
        }}
        onDelete={canEdit && !removal.isPending ? () => removal.confirm(list) : undefined} />)}
      {!sources.length && !isError && <Text style={styles.subtitle}>{isPending ? 'Loading lists…' : 'No original lists in your current access.'}</Text>}
    </View>
  </BottomSheet>;
}

const styles = StyleSheet.create({
  sources: { gap: Spacing.sm, paddingBottom: Spacing.md },
  emptyTitle: { ...Typography.h4, color: Colors.light.text },
  subtitle: { ...Typography.caption, color: Colors.light.textSecondary },
  link: { ...Typography.bodySmall, color: Colors.light.primary, padding: Spacing.sm },
});
