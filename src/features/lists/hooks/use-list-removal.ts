import { Alert } from 'react-native';
import { useToast } from '@/components/ui/toast';
import { listRemovalKind } from '../list-management';
import type { ShoppingList } from '../types';
import { useDeleteList, useUntrackList } from './use-lists';

/** Shared confirmation and ownership semantics for every shopping list. */
export function useListRemoval() {
  const { showToast } = useToast();
  const remove = useDeleteList();
  const untrack = useUntrackList();
  return {
    isPending: remove.isPending || untrack.isPending,
    confirm: (list: ShoppingList) => {
      const shared = listRemovalKind(list) === 'untrack';
      Alert.alert(shared ? 'Remove shared list' : 'Delete list', shared
        ? `Remove "${list.name}" from your lists? The original list and its items remain available to its owner.`
        : `Delete "${list.name}" and all its items?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: shared ? 'Remove' : 'Delete', style: 'destructive', onPress: () => {
          (shared ? untrack : remove).mutate(list.id, { onError: error => showToast(error.message, 'error') });
        } },
      ]);
    },
  };
}
