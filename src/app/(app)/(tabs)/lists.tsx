import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { CreateListSheet } from '@/features/lists/components/create-list-sheet';
import { ListCard } from '@/features/lists/components/list-card';
import { useCreateList, useDeleteList, useLists, useUntrackList } from '@/features/lists/hooks/use-lists';
import type { ShoppingList } from '@/features/lists/types';
import { matchesSearch } from '@/utils/search';

/**
 * Shopping Lists tab. Cached lists render instantly; refreshes are silent.
 * Creating and deleting are optimistic — no blocking spinners.
 */
export default function ListsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { data: lists, isLoading, isRefetching, refetch } = useLists();
  const createList = useCreateList();
  const deleteList = useDeleteList();
  const untrackList = useUntrackList();

  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const filteredLists = useMemo(() => {
    if (!lists) return [];
    const term = filter.trim();
    if (!term) return lists;
    return lists.filter((list) => matchesSearch(term, list.name));
  }, [lists, filter]);

  const handleCreate = (name: string) => {
    createList.mutate(
      { name },
      { onError: (error) => showToast(error.message, 'error') },
    );
  };

  const handleDelete = (list: ShoppingList) => {
    // Shared lists (tracked from another user) are removed from *my* lists
    // without deleting the underlying collaborative list for everyone else.
    if (list.copiedFromName) {
      Alert.alert(
        'Remove shared list',
        `Remove "${list.name}" from your lists? It stays with ${list.copiedFromName}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () =>
              untrackList.mutate(list.id, {
                onError: (error) => showToast(error.message, 'error'),
              }),
          },
        ],
      );
      return;
    }

    Alert.alert('Delete list', `Delete "${list.name}" and all its items?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteList.mutate(list.id, {
            onError: (error) => showToast(error.message, 'error'),
          }),
      },
    ]);
  };

  const showEmpty = !isLoading && filteredLists.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Shopping Lists</Text>
            <Text style={styles.subtitle}>
              {lists?.length ?? 0} {(lists?.length ?? 0) === 1 ? 'list' : 'lists'}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowCreate(true)}
            style={({ pressed }) => [styles.newButton, pressed && styles.newButtonPressed]}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>
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
            refreshing={isRefetching && !isLoading}
            onRefresh={refetch}
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
              onDelete={() => handleDelete(item)}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={
          showEmpty ? (
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
                  : 'Create your first shopping list to start adding products.'}
              </Text>
            </View>
          ) : null
        }
      />

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
