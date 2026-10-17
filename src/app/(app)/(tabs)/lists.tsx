import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateListSheet } from '@/features/lists/components/create-list-sheet';
import { OriginalListsSheet } from '@/features/lists/components/original-lists-sheet';
import { useListRemoval } from '@/features/lists/hooks/use-list-removal';
import { listRemovalChoices } from '@/features/lists/list-management';
import { ListCard } from '@/features/lists/components/list-card';
import { ListCardsSkeleton } from '@/features/lists/components/list-skeletons';
import { useCreateList, useLists } from '@/features/lists/hooks/use-lists';
import { useShopFeature } from '@/features/employees/permissions';
import { collapseOutOfStockLists } from '@/features/lists/out-of-stock';
import type { ShoppingList } from '@/features/lists/types';
import { usePullToRefresh, useRefetchOnFocus } from '@/hooks/use-query-refresh';
import { matchesSearch } from '@/utils/search';

/**
 * Shopping Lists tab. Cached lists render instantly; refreshes are silent.
 * Creating and deleting are optimistic — no blocking spinners.
 */
export default function ListsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { data: lists, isError, fetchStatus, refetch } = useLists();
  const { refreshing, onRefresh } = usePullToRefresh(refetch, fetchStatus);
  useRefetchOnFocus(refetch);
  const canCreate = useShopFeature('feature.lists', 'write');
  const canEdit = useShopFeature('feature.lists', 'edit');
  const createList = useCreateList();
  const removal = useListRemoval();

  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showRemoveSources, setShowRemoveSources] = useState(false);

  const overviewLists = useMemo(() => collapseOutOfStockLists(lists ?? []), [lists]);
  const filteredLists = useMemo(() => {
    const term = filter.trim();
    if (!term) return overviewLists;
    return overviewLists.filter((list) => matchesSearch(term, list.name));
  }, [overviewLists, filter]);

  const handleCreate = (name: string) => {
    createList.mutate(
      { name },
      { onError: (error) => showToast(error.message, 'error') },
    );
  };

  const handleDelete = (list: ShoppingList) => {
    const choices = listRemovalChoices(list, lists ?? []);
    if (choices.length === 1) removal.confirm(choices[0]);
    else setShowRemoveSources(true);
  };

  // No cached lists yet: skeleton while loading/restoring, retry state once it gives up.
  const isOffline = fetchStatus === 'paused';
  const loadFailed = !lists && fetchStatus !== 'fetching' && (isError || isOffline);
  const showSkeleton = !lists && !loadFailed;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Shopping Lists</Text>
            <Text style={styles.subtitle}>
              {overviewLists.length} {overviewLists.length === 1 ? 'list' : 'lists'}
            </Text>
          </View>
          {canCreate && <Pressable
            onPress={() => setShowCreate(true)}
            style={({ pressed }) => [styles.newButton, pressed && styles.newButtonPressed]}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>}
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.light.textLight} />
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder="Search your lists"
            placeholderTextColor={Colors.light.textLight}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {filter.length > 0 && (
            <Pressable onPress={() => setFilter('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.light.textLight} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filteredLists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.light.primary}
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.duration(300).delay(Math.min(index, 8) * 40)}
            layout={LinearTransition.springify().damping(20)}
          >
            <ListCard
              list={item}
              onPress={() => router.push({ pathname: '/(app)/list/[id]', params: { id: item.id } })}
              onDelete={canEdit && !removal.isPending ? () => handleDelete(item) : undefined}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={
          showSkeleton ? (
            <Animated.View exiting={FadeOut.duration(200)}>
              <ListCardsSkeleton />
            </Animated.View>
          ) : loadFailed ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={isOffline ? 'cloud-offline-outline' : 'alert-circle-outline'}
                  size={40}
                  color={Colors.light.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {isOffline ? 'You’re offline' : 'Couldn’t load your lists'}
              </Text>
              <Text style={styles.emptyBody}>
                {isOffline
                  ? 'Your lists will load as soon as you’re back online.'
                  : 'Check your connection and try again.'}
              </Text>
              {!isOffline && (
                <Pressable
                  onPress={() => refetch()}
                  style={({ pressed }) => [
                    styles.newButton,
                    styles.retryButton,
                    pressed && styles.newButtonPressed,
                  ]}
                >
                  <Ionicons name="refresh" size={18} color="#FFFFFF" />
                  <Text style={styles.newButtonText}>Try again</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cart-outline" size={40} color={Colors.light.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter ? 'No lists match your search' : 'No lists yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {filter
                  ? 'Try a different name.'
                  : canCreate ? 'Create your first shopping list to start adding products.' : 'Your shop owner can enable Write access to let you create lists.'}
              </Text>
            </View>
          )
        }
      />

      <OriginalListsSheet visible={showRemoveSources} onClose={() => setShowRemoveSources(false)} mode="remove" />

      <CreateListSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Typography.h2,
    color: Colors.light.text,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    ...Shadows.sm,
  },
  newButtonPressed: {
    backgroundColor: Colors.light.buttonPrimaryPressed,
  },
  newButtonText: {
    ...Typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  retryButton: {
    marginTop: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.light.text,
    paddingVertical: 10,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  emptyBody: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
  },
});
