import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import {
  addExpiryProduct,
  createExpiryCategory,
  deleteExpiryCategory,
  deleteExpiryProduct,
  expiryKeys,
  fetchExpiryCategories,
  fetchExpiryNotifications,
  fetchExpiryProducts,
  searchExpiryProducts,
  updateExpiryCategory,
  updateExpiryProduct,
  type ExpiryCategory,
  type ExpiryFilter,
  type ExpiryProduct,
  type ExpirySearchProduct,
  type ExpiryStatus,
} from '@/features/expiry/api';
import { matchesSearch } from '@/utils/search';
import { DateTimeField } from '@/features/shop-tools/components/date-time-field';
import { EmptyState } from '@/features/shop-tools/components/empty-state';
import { Fab, RecordCard, StatusPill } from '@/features/shop-tools/components/primitives';
import { SegmentedTabs } from '@/features/shop-tools/components/segmented-tabs';
import { ListSkeleton } from '@/features/shop-tools/components/stat-card';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { formatDate, toDateParam } from '@/features/shop-tools/format';

type Tab = 'all' | 'expiring-soon' | 'expired' | 'disposed' | 'categories';

const statusColor: Record<ExpiryStatus, string> = {
  OK: Colors.light.success,
  NOTICE: Colors.light.primary,
  WARNING: Colors.light.warning,
  CRITICAL: Colors.light.error,
  EXPIRED: Colors.light.error,
  DISPOSED: Colors.light.textLight,
};

/** Expiry date tracking with reminder categories and dispose flow. */
export default function ManageExpiryScreen() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ExpiryProduct | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const filter: ExpiryFilter = tab === 'categories' ? 'all' : tab === 'all' ? 'active' : tab;
  const list = useQuery({
    queryKey: expiryKeys.list(filter),
    queryFn: () => fetchExpiryProducts(filter),
    staleTime: 30_000,
  });
  const notifications = useQuery({
    queryKey: expiryKeys.notifications,
    queryFn: fetchExpiryNotifications,
    staleTime: 60_000,
  });
  const categories = useQuery({
    queryKey: expiryKeys.categories,
    queryFn: fetchExpiryCategories,
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expiry'] });
  };
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateExpiryProduct>[1] }) =>
      updateExpiryProduct(id, input),
    onSettled: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteExpiryProduct, onSettled: invalidate });

  const counts = list.data?.counts;
  const visible = useMemo(() => {
    const products = list.data?.products ?? [];
    const term = search.trim();
    if (!term) return products;
    return products.filter((p) =>
      matchesSearch(term, p.productName, p.productBarcode, p.batchNumber),
    );
  }, [list.data, search]);

  const toggleDisposed = (product: ExpiryProduct) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    update.mutate(
      { id: product.id, input: { isDisposed: !product.isDisposed } },
      {
        onSuccess: () =>
          showToast(product.isDisposed ? 'Restored to tracking' : 'Marked as disposed', 'success'),
        onError: (error: any) => showToast(error?.message ?? 'Could not update', 'error'),
      },
    );
  };

  const handleDelete = (product: ExpiryProduct) => {
    Alert.alert('Remove from tracking', `Stop tracking ${product.productName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(product.id, {
            onSuccess: () => showToast('Removed from tracking', 'success'),
            onError: (error: any) => showToast(error?.message ?? 'Could not remove', 'error'),
          }),
      },
    ]);
  };

  const notificationCount = notifications.data?.length ?? 0;

  return (
    <ToolScreen
      title="Manage Expiry"
      subtitle="Track dates before they cost you"
      rightIcon={notificationCount > 0 ? 'notifications' : 'notifications-outline'}
      onRightPress={() => setShowNotifications(true)}
    >
      <SegmentedTabs<Tab>
        options={[
          { value: 'all', label: 'Active', count: counts?.all },
          { value: 'expiring-soon', label: 'Expiring', count: counts?.expiringSoon },
          { value: 'expired', label: 'Expired', count: counts?.expired },
          { value: 'disposed', label: 'Disposed', count: counts?.disposed },
          { value: 'categories', label: 'Reminders' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'categories' ? (
        <CategoriesTab categories={categories} />
      ) : (
        <>
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={Colors.light.textLight} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, barcode or batch"
                placeholderTextColor={Colors.light.textLight}
                style={styles.searchInput}
              />
            </View>
          </View>
          {list.isLoading ? (
            <ListSkeleton rows={6} height={88} />
          ) : (
            <FlatList
              data={visible}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={list.isRefetching}
                  onRefresh={() => {
                    list.refetch();
                    notifications.refetch();
                  }}
                  tintColor={Colors.light.primary}
                />
              }
              renderItem={({ item }) => (
                <ExpiryRow
                  product={item}
                  onEdit={() => setEditing(item)}
                  onToggleDisposed={() => toggleDisposed(item)}
                  onDelete={() => handleDelete(item)}
                />
              )}
              ListEmptyComponent={
                <EmptyState
                  icon="calendar-outline"
                  title="Nothing here"
                  subtitle="Add products with their expiry dates to get reminders before they expire."
                />
              }
            />
          )}
          <Fab label="Track Product" onPress={() => setShowAdd(true)} />
        </>
      )}

      <AddExpirySheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        categories={categories.data ?? []}
        onSaved={() => {
          setShowAdd(false);
          invalidate();
        }}
      />

      <EditExpirySheet
        product={editing}
        onClose={() => setEditing(null)}
        saving={update.isPending}
        onSave={(input) => {
          if (!editing) return;
          update.mutate(
            { id: editing.id, input },
            {
              onSuccess: () => {
                setEditing(null);
                showToast('Updated', 'success');
              },
              onError: (error: any) => showToast(error?.message ?? 'Could not update', 'error'),
            },
          );
        }}
      />

      <BottomSheet visible={showNotifications} onClose={() => setShowNotifications(false)}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Expiry Alerts</Text>
          {notificationCount === 0 ? (
            <Text style={styles.emptyNote}>No alerts right now — you&apos;re all caught up.</Text>
          ) : (
            <ScrollView style={styles.notifScroll}>
              {(notifications.data ?? []).map((n) => (
                <View key={n.id} style={styles.notifRow}>
                  <View
                    style={[
                      styles.notifDot,
                      {
                        backgroundColor:
                          n.priority === 'critical'
                            ? Colors.light.error
                            : n.priority === 'high'
                              ? Colors.light.warning
                              : Colors.light.primary,
                      },
                    ]}
                  />
                  <View style={styles.flex1}>
                    <Text style={styles.notifMessage}>{n.message}</Text>
                    <Text style={styles.notifMeta}>
                      Qty {n.quantity} · Expires {formatDate(n.expiryDate)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </BottomSheet>
    </ToolScreen>
  );
}

function ExpiryRow({
  product,
  onEdit,
  onToggleDisposed,
  onDelete,
}: {
  product: ExpiryProduct;
  onEdit: () => void;
  onToggleDisposed: () => void;
  onDelete: () => void;
}) {
  const daysLabel = product.isDisposed
    ? `Disposed ${product.disposedAt ? formatDate(product.disposedAt) : ''}`
    : product.daysUntilExpiry < 0
      ? `Expired ${Math.abs(product.daysUntilExpiry)}d ago`
      : product.daysUntilExpiry === 0
        ? 'Expires today'
        : `${product.daysUntilExpiry}d left`;

  return (
    <RecordCard onPress={onEdit} onLongPress={onDelete}>
      <View style={styles.expiryRow}>
        {product.productImage ? (
          <Image source={{ uri: product.productImage }} style={styles.productThumb} contentFit="contain" />
        ) : (
          <View style={[styles.productThumb, styles.thumbPlaceholder]}>
            <Ionicons name="cube-outline" size={20} color={Colors.light.textLight} />
          </View>
        )}
        <View style={styles.flex1}>
          <Text style={styles.recordTitle} numberOfLines={1}>
            {product.productName}
          </Text>
          <Text style={styles.recordMeta}>
            Qty {product.quantity} · {formatDate(product.expiryDate)}
            {product.batchNumber ? ` · Batch ${product.batchNumber}` : ''}
          </Text>
          {!!product.categoryName && (
            <Text style={styles.categoryTag}>{product.categoryName}</Text>
          )}
        </View>
        <View style={styles.expiryRight}>
          <StatusPill label={daysLabel} color={statusColor[product.status]} />
          <Pressable onPress={onToggleDisposed} hitSlop={8} style={styles.disposeButton}>
            <Ionicons
              name={product.isDisposed ? 'refresh-outline' : 'trash-outline'}
              size={18}
              color={product.isDisposed ? Colors.light.primary : Colors.light.error}
            />
            <Text
              style={[
                styles.disposeText,
                { color: product.isDisposed ? Colors.light.primary : Colors.light.error },
              ]}
            >
              {product.isDisposed ? 'Restore' : 'Dispose'}
            </Text>
          </Pressable>
        </View>
      </View>
    </RecordCard>
  );
}

function AddExpirySheet({
  visible,
  onClose,
  categories,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  categories: ExpiryCategory[];
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ExpirySearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ExpirySearchProduct | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [quantityText, setQuantityText] = useState('1');
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);

  const create = useMutation({ mutationFn: addExpiryProduct });

  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setQuery('');
      setHits([]);
      setSelected(null);
      setExpiryDate(null);
      setQuantityText('1');
      setBatchNumber('');
      setNotes('');
      setCategoryId(undefined);
    }
  }

  useEffect(() => {
    if (!visible || selected || query.trim().length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchExpiryProducts({ query: query.trim() })
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, selected, visible]);

  const quantity = Number(quantityText);
  const valid = selected != null && expiryDate != null && Number.isFinite(quantity) && quantity > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware scrollable>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Track a Product</Text>
        {!selected ? (
          <>
            <TextField
              label="Find product"
              value={query}
              onChangeText={setQuery}
              placeholder="Type a name or scan/type a barcode"
            />
            {searching && <Text style={styles.emptyNote}>Searching…</Text>}
            <ScrollView style={styles.hitsScroll} keyboardShouldPersistTaps="handled">
              {hits.map((hit) => (
                <Pressable key={hit.id} style={styles.hitRow} onPress={() => setSelected(hit)}>
                  {hit.img ? (
                    <Image source={{ uri: hit.img }} style={styles.hitThumb} contentFit="contain" />
                  ) : (
                    <View style={[styles.hitThumb, styles.thumbPlaceholder]}>
                      <Ionicons name="cube-outline" size={16} color={Colors.light.textLight} />
                    </View>
                  )}
                  <View style={styles.flex1}>
                    <Text style={styles.hitTitle} numberOfLines={1}>
                      {hit.title}
                    </Text>
                    {!!hit.barcode && <Text style={styles.hitMeta}>{hit.barcode}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.light.textLight} />
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            <Pressable style={styles.selectedRow} onPress={() => setSelected(null)}>
              <Text style={styles.hitTitle} numberOfLines={1}>
                {selected.title}
              </Text>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
            <DateTimeField
              label="Expiry date"
              mode="date"
              value={expiryDate}
              onChange={setExpiryDate}
              placeholder="Select date"
              minimumDate={new Date()}
            />
            <View style={styles.pairRow}>
              <View style={styles.flex1}>
                <TextField label="Quantity" value={quantityText} onChangeText={setQuantityText} keyboardType="number-pad" />
              </View>
              <View style={styles.flex1}>
                <TextField label="Batch (optional)" value={batchNumber} onChangeText={setBatchNumber} placeholder="e.g. B123" />
              </View>
            </View>
            {categories.length > 0 && (
              <View>
                <Text style={styles.fieldLabel}>Reminder category (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => setCategoryId(categoryId === cat.id ? undefined : cat.id)}
                      style={[styles.catChip, categoryId === cat.id && styles.catChipActive]}
                    >
                      <Text style={[styles.catChipText, categoryId === cat.id && styles.catChipTextActive]}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Shelf location, supplier..." />
            <PrimaryButton
              title="Start Tracking"
              loading={create.isPending}
              disabled={!valid}
              onPress={() =>
                valid &&
                create
                  .mutateAsync({
                    productId: selected.id,
                    expiryDate: toDateParam(expiryDate!),
                    quantity,
                    batchNumber: batchNumber.trim() || undefined,
                    notes: notes.trim() || undefined,
                    categoryId,
                  })
                  .then(() => {
                    showToast('Product tracked', 'success');
                    onSaved();
                  })
                  .catch((error: any) => showToast(error?.message ?? 'Could not add', 'error'))
              }
            />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

function EditExpirySheet({
  product,
  onClose,
  onSave,
  saving,
}: {
  product: ExpiryProduct | null;
  onClose: () => void;
  onSave: (input: { expiryDate?: string; quantity?: number; batchNumber?: string; notes?: string }) => void;
  saving: boolean;
}) {
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [quantityText, setQuantityText] = useState('1');
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = product?.id ?? null;
  if (key !== lastKey) {
    setLastKey(key);
    if (product) {
      setExpiryDate(new Date(product.expiryDate));
      setQuantityText(String(product.quantity));
      setBatchNumber(product.batchNumber ?? '');
      setNotes(product.notes ?? '');
    }
  }

  const quantity = Number(quantityText);
  const valid = expiryDate != null && Number.isFinite(quantity) && quantity > 0;

  return (
    <BottomSheet visible={product != null} onClose={onClose} keyboardAware scrollable>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {product?.productName ?? ''}
        </Text>
        <DateTimeField label="Expiry date" mode="date" value={expiryDate} onChange={setExpiryDate} />
        <View style={styles.pairRow}>
          <View style={styles.flex1}>
            <TextField label="Quantity" value={quantityText} onChangeText={setQuantityText} keyboardType="number-pad" />
          </View>
          <View style={styles.flex1}>
            <TextField label="Batch" value={batchNumber} onChangeText={setBatchNumber} placeholder="Optional" />
          </View>
        </View>
        <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
        <PrimaryButton
          title="Save Changes"
          loading={saving}
          disabled={!valid}
          onPress={() =>
            valid &&
            onSave({
              expiryDate: toDateParam(expiryDate!),
              quantity,
              batchNumber: batchNumber.trim(),
              notes: notes.trim(),
            })
          }
        />
      </View>
    </BottomSheet>
  );
}

function CategoriesTab({
  categories,
}: {
  categories: ReturnType<typeof useQuery<ExpiryCategory[]>>;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ExpiryCategory | null>(null);
  const [showForm, setShowForm] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: expiryKeys.categories });
  const create = useMutation({ mutationFn: createExpiryCategory, onSettled: invalidate });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateExpiryCategory>[1] }) =>
      updateExpiryCategory(id, input),
    onSettled: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteExpiryCategory, onSettled: invalidate });

  return (
    <>
      {categories.isLoading ? (
        <ListSkeleton rows={4} height={72} />
      ) : (
        <FlatList
          data={categories.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={categories.isRefetching}
              onRefresh={categories.refetch}
              tintColor={Colors.light.primary}
            />
          }
          renderItem={({ item }) => (
            <RecordCard
              onPress={() => {
                setEditing(item);
                setShowForm(true);
              }}
              onLongPress={() =>
                Alert.alert('Delete category', `Delete "${item.name}"? Products keep tracking without it.`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () =>
                      remove.mutate(item.id, {
                        onSuccess: () => showToast('Category deleted', 'success'),
                        onError: (error: any) => showToast(error?.message ?? 'Could not delete', 'error'),
                      }),
                  },
                ])
              }
            >
              <View style={styles.flex1}>
                <View style={styles.catHead}>
                  <Text style={styles.recordTitle}>{item.name}</Text>
                  {!item.isActive && <StatusPill label="Paused" color={Colors.light.textLight} />}
                </View>
                <Text style={styles.recordMeta}>
                  Remind at {[...item.reminderDays].sort((a, b) => b - a).join(', ')} days ·{' '}
                  {item.productCount ?? 0} product(s)
                </Text>
                {!!item.description && <Text style={styles.recordMeta}>{item.description}</Text>}
              </View>
            </RecordCard>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="alarm-outline"
              title="No reminder rules"
              subtitle="Create categories like 'Dairy' or 'Bakery' with their own reminder days."
            />
          }
        />
      )}
      <Fab
        label="New Rule"
        onPress={() => {
          setEditing(null);
          setShowForm(true);
        }}
      />
      <CategoryForm
        visible={showForm}
        category={editing}
        saving={create.isPending || update.isPending}
        onClose={() => setShowForm(false)}
        onSave={(input) => {
          const mutation = editing
            ? update.mutateAsync({ id: editing.id, input })
            : create.mutateAsync(input);
          mutation
            .then(() => {
              setShowForm(false);
              showToast(editing ? 'Category updated' : 'Category created', 'success');
            })
            .catch((error: any) => showToast(error?.message ?? 'Could not save', 'error'));
        }}
      />
    </>
  );
}

function CategoryForm({
  visible,
  category,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  category: ExpiryCategory | null;
  onClose: () => void;
  onSave: (input: { name: string; description?: string; reminderDays: number[] }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [daysText, setDaysText] = useState('10, 7, 3');

  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = visible ? (category?.id ?? 'new') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setName(category?.name ?? '');
      setDescription(category?.description ?? '');
      setDaysText(category ? [...category.reminderDays].sort((a, b) => b - a).join(', ') : '10, 7, 3');
    }
  }

  const reminderDays = daysText
    .split(/[,\s]+/)
    .map((token) => Number(token))
    .filter((n) => Number.isInteger(n) && n >= 0);
  const valid = name.trim().length > 0 && reminderDays.length > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware scrollable>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>{category ? 'Edit Reminder Rule' : 'New Reminder Rule'}</Text>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Dairy" />
        <TextField
          label="Remind me at (days before expiry)"
          value={daysText}
          onChangeText={setDaysText}
          placeholder="e.g. 10, 7, 3"
          keyboardType="numbers-and-punctuation"
        />
        <TextField label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Milk, cheese, yoghurt..." />
        <PrimaryButton
          title={category ? 'Save Changes' : 'Create Rule'}
          loading={saving}
          disabled={!valid}
          onPress={() =>
            valid &&
            onSave({
              name: name.trim(),
              description: description.trim() || undefined,
              reminderDays,
            })
          }
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  searchRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    ...Typography.body,
    color: Colors.light.text,
    flex: 1,
    paddingVertical: 10,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  expiryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  productThumb: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFF',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
  },
  recordTitle: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  recordMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  categoryTag: {
    ...Typography.caption,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  expiryRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  disposeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disposeText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  sheetContent: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  sheetTitle: {
    ...Typography.h4,
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  emptyNote: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  hitsScroll: {
    maxHeight: 280,
  },
  hitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  hitThumb: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#FFF',
  },
  hitTitle: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.text,
  },
  hitMeta: {
    ...Typography.caption,
    color: Colors.light.textLight,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  changeLink: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  pairRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
  },
  chipScroll: {
    gap: Spacing.sm,
  },
  catChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundCard,
  },
  catChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  catChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  catChipTextActive: {
    color: '#FFF',
  },
  catHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notifScroll: {
    maxHeight: 380,
  },
  notifRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
    alignItems: 'flex-start',
  },
  notifDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  notifMessage: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.text,
  },
  notifMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
});
