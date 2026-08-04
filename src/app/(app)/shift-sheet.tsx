import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  createShiftSheet,
  deleteShiftSheet,
  fetchShiftSheets,
  shiftSheetKeys,
  updateShiftSheet,
  type ShiftSheetInput,
  type ShiftSheetRecord,
} from '@/features/shift-sheets/api';
import { DateTimeField } from '@/features/shop-tools/components/date-time-field';
import { EmptyState } from '@/features/shop-tools/components/empty-state';
import { Fab, RecordCard } from '@/features/shop-tools/components/primitives';
import { ListSkeleton, StatCard } from '@/features/shop-tools/components/stat-card';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { useIsOwner } from '@/features/shop-tools/hooks/use-is-owner';
import {
  formatDate,
  formatMoney,
  parseMoneyInput,
  toDateParam,
} from '@/features/shop-tools/format';

/**
 * End-of-shift cash/card totals. Employees submit ONE sheet per day and cannot
 * change it after submission; the owner can view, edit and delete everything.
 */
export default function ShiftSheetScreen() {
  const isOwner = useIsOwner();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [editing, setEditing] = useState<ShiftSheetRecord | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  const filters = {
    startDate: startDate ? toDateParam(startDate) : undefined,
    endDate: endDate ? toDateParam(endDate) : undefined,
  };
  const records = useQuery({
    queryKey: shiftSheetKeys.list(filters),
    queryFn: () => fetchShiftSheets({ ...filters, limit: 500 }),
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shift-sheet'] });
  const create = useMutation({ mutationFn: createShiftSheet, onSettled: invalidate });
  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<ShiftSheetInput>) =>
      updateShiftSheet(id, input),
    onSettled: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteShiftSheet, onSettled: invalidate });

  const visible = useMemo(() => {
    const all = records.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (r) => r.recordedBy.toLowerCase().includes(term) || (r.notes ?? '').toLowerCase().includes(term),
    );
  }, [records.data, search]);

  // Employees may create at most one sheet per calendar day (client-enforced).
  const todayParam = toDateParam(new Date());
  const alreadySubmittedToday =
    !isOwner &&
    (records.data ?? []).some(
      (r) => r.recordedBy === user?.name && toDateParam(new Date(r.shiftDate)) === todayParam,
    );

  const totals = useMemo(() => {
    const sum = (get: (r: ShiftSheetRecord) => number) =>
      visible.reduce((acc, r) => acc + get(r), 0);
    return {
      cash: sum((r) => Number(r.cashTotal)),
      card: sum((r) => Number(r.cardTotal)),
      sales: sum((r) => Number(r.totalSales)),
    };
  }, [visible]);

  const handleDelete = (record: ShiftSheetRecord) => {
    if (!isOwner) return;
    Alert.alert('Delete shift sheet', `Delete the sheet for ${formatDate(record.shiftDate)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(record.id, {
            onSuccess: () => showToast('Shift sheet deleted', 'success'),
            onError: (error: any) => showToast(error?.message ?? 'Could not delete', 'error'),
          }),
      },
    ]);
  };

  return (
    <ToolScreen title="Shift Sheet" subtitle="Daily takings">
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={Colors.light.textLight} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by employee or notes"
            placeholderTextColor={Colors.light.textLight}
            style={styles.searchInput}
          />
        </View>
      </View>
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <DateTimeField label="From" mode="date" value={startDate} onChange={setStartDate} placeholder="Any" />
        </View>
        <View style={styles.dateField}>
          <DateTimeField label="To" mode="date" value={endDate} onChange={setEndDate} placeholder="Any" />
        </View>
      </View>

      {records.isLoading ? (
        <ListSkeleton rows={5} height={84} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            visible.length > 0 ? (
              <View style={styles.statsRow}>
                <StatCard label="Cash" value={formatMoney(totals.cash)} />
                <StatCard label="Card" value={formatMoney(totals.card)} />
                <StatCard label="Total" value={formatMoney(totals.sales)} tone="success" />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={records.isRefetching}
              onRefresh={records.refetch}
              tintColor={Colors.light.primary}
            />
          }
          renderItem={({ item }) => (
            <RecordCard
              onPress={
                isOwner
                  ? () => {
                      setEditing(item);
                      setShowSheet(true);
                    }
                  : undefined
              }
              onLongPress={isOwner ? () => handleDelete(item) : undefined}
            >
              <View style={styles.recordRow}>
                <View style={styles.recordBody}>
                  <Text style={styles.recordTitle}>{formatDate(item.shiftDate)}</Text>
                  <Text style={styles.recordMeta}>
                    {item.recordedBy} · Cash {formatMoney(item.cashTotal)} · Card {formatMoney(item.cardTotal)}
                  </Text>
                  {!!item.notes && <Text style={styles.recordNotes}>{item.notes}</Text>}
                </View>
                <Text style={styles.recordTotal}>{formatMoney(item.totalSales)}</Text>
              </View>
            </RecordCard>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No shift sheets"
              subtitle={
                alreadySubmittedToday
                  ? "You've already submitted today's sheet."
                  : 'Record cash and card totals at the end of a shift.'
              }
            />
          }
        />
      )}

      {(isOwner || !alreadySubmittedToday) && (
        <Fab
          label="New Sheet"
          onPress={() => {
            setEditing(null);
            setShowSheet(true);
          }}
        />
      )}

      <ShiftSheetForm
        visible={showSheet}
        record={editing}
        onClose={() => setShowSheet(false)}
        saving={create.isPending || update.isPending}
        onSave={(input) => {
          const mutation = editing
            ? update.mutateAsync({ id: editing.id, ...input })
            : create.mutateAsync(input);
          mutation
            .then(() => {
              setShowSheet(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showToast(editing ? 'Shift sheet updated' : 'Shift sheet submitted', 'success');
            })
            .catch((error: any) => showToast(error?.message ?? 'Could not save', 'error'));
        }}
      />
    </ToolScreen>
  );
}

function ShiftSheetForm({
  visible,
  record,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  record: ShiftSheetRecord | null;
  onClose: () => void;
  onSave: (input: ShiftSheetInput) => void;
  saving: boolean;
}) {
  const [shiftDate, setShiftDate] = useState<Date>(new Date());
  const [cashText, setCashText] = useState('');
  const [cardText, setCardText] = useState('');
  const [notes, setNotes] = useState('');

  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = visible ? (record?.id ?? 'new') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setShiftDate(record ? new Date(record.shiftDate) : new Date());
      setCashText(record ? Number(record.cashTotal).toFixed(2) : '');
      setCardText(record ? Number(record.cardTotal).toFixed(2) : '');
      setNotes(record?.notes ?? '');
    }
  }

  const cash = parseMoneyInput(cashText);
  const card = parseMoneyInput(cardText);
  const valid = cash != null && cash >= 0 && card != null && card >= 0;
  const total = valid ? cash + card : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>{record ? 'Edit Shift Sheet' : 'New Shift Sheet'}</Text>
        <DateTimeField label="Shift date" mode="date" value={shiftDate} onChange={setShiftDate} maximumDate={new Date()} />
        <View style={styles.dateRowInner}>
          <View style={styles.dateField}>
            <TextField label="Cash total (£)" value={cashText} onChangeText={setCashText} keyboardType="decimal-pad" placeholder="0.00" />
          </View>
          <View style={styles.dateField}>
            <TextField label="Card total (£)" value={cardText} onChangeText={setCardText} keyboardType="decimal-pad" placeholder="0.00" />
          </View>
        </View>
        {total != null && (
          <View style={styles.totalPreview}>
            <Text style={styles.totalPreviewLabel}>Total sales</Text>
            <Text style={styles.totalPreviewValue}>{formatMoney(total)}</Text>
          </View>
        )}
        <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Discrepancies, refunds..." />
        {!record && (
          <Text style={styles.submitWarning}>
            Sheets can&apos;t be edited after submission — double-check the totals.
          </Text>
        )}
        <PrimaryButton
          title={record ? 'Save Changes' : 'Submit Sheet'}
          onPress={() =>
            valid &&
            onSave({
              shiftDate: toDateParam(shiftDate),
              cashTotal: cash!,
              cardTotal: card!,
              notes: notes.trim() || undefined,
            })
          }
          disabled={!valid}
          loading={saving}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  dateRowInner: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dateField: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  recordBody: {
    flex: 1,
    gap: 2,
  },
  recordTitle: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  recordMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  recordNotes: {
    ...Typography.caption,
    color: Colors.light.textLight,
    fontStyle: 'italic',
  },
  recordTotal: {
    ...Typography.price,
    color: Colors.light.success,
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
  totalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.primaryLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  totalPreviewLabel: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  totalPreviewValue: {
    ...Typography.price,
    color: Colors.light.primary,
  },
  submitWarning: {
    ...Typography.caption,
    color: Colors.light.warning,
  },
});
