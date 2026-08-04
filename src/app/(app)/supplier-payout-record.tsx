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
import { OptionPicker } from '@/features/shop-tools/components/option-picker';
import { DateTimeField } from '@/features/shop-tools/components/date-time-field';
import { EmptyState } from '@/features/shop-tools/components/empty-state';
import { Fab, RecordCard, StatusPill } from '@/features/shop-tools/components/primitives';
import { SegmentedTabs } from '@/features/shop-tools/components/segmented-tabs';
import { ListSkeleton, StatCard } from '@/features/shop-tools/components/stat-card';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import {
  createPayout,
  deletePayout,
  fetchPayouts,
  payoutKeys,
  updatePayout,
  type PaymentMethod,
  type PaymentStatus,
  type SupplierPayoutInput,
  type SupplierPayoutRecord,
} from '@/features/supplier-payouts/api';
import {
  formatDateTime,
  formatMoney,
  parseMoneyInput,
  toDateParam,
} from '@/features/shop-tools/format';

type StatusTab = 'all' | 'TO_PAY' | 'PAID';
type RangeTab = 'today' | '7d' | '30d' | 'custom' | 'all';

/** Supplier payout ledger (owner-only tool, hidden from employees on the dashboard). */
export default function SupplierPayoutScreen() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [range, setRange] = useState<RangeTab>('all');
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SupplierPayoutRecord | null>(null);
  const [showForm, setShowForm] = useState(false);

  const dates = useMemo(() => {
    const now = new Date();
    if (range === 'today') return { startDate: toDateParam(now), endDate: toDateParam(now) };
    if (range === '7d') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { startDate: toDateParam(start), endDate: undefined };
    }
    if (range === '30d') {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { startDate: toDateParam(start), endDate: undefined };
    }
    if (range === 'custom') {
      return {
        startDate: customStart ? toDateParam(customStart) : undefined,
        endDate: customEnd ? toDateParam(customEnd) : undefined,
      };
    }
    return { startDate: undefined, endDate: undefined };
  }, [range, customStart, customEnd]);

  const filters = {
    ...dates,
    paymentStatus: statusTab === 'all' ? undefined : statusTab,
  };
  const records = useQuery({
    queryKey: payoutKeys.list(filters),
    queryFn: () => fetchPayouts({ ...filters, limit: 500 }),
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['supplier-payouts'] });
  const create = useMutation({ mutationFn: createPayout, onSettled: invalidate });
  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<SupplierPayoutInput>) =>
      updatePayout(id, input),
    onSettled: invalidate,
  });
  const remove = useMutation({ mutationFn: deletePayout, onSettled: invalidate });

  const visible = useMemo(() => {
    const all = records.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (r) =>
        r.supplier.toLowerCase().includes(term) ||
        (r.notes ?? '').toLowerCase().includes(term) ||
        r.recordedBy.toLowerCase().includes(term),
    );
  }, [records.data, search]);

  const totals = useMemo(() => {
    const pending = visible
      .filter((r) => r.paymentStatus === 'TO_PAY')
      .reduce((acc, r) => acc + Number(r.amount), 0);
    const paid = visible
      .filter((r) => r.paymentStatus === 'PAID')
      .reduce((acc, r) => acc + Number(r.amount), 0);
    return { pending, paid };
  }, [visible]);

  const handleDelete = (record: SupplierPayoutRecord) => {
    Alert.alert('Delete payout', `Delete the record for ${record.supplier}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(record.id, {
            onSuccess: () => showToast('Record deleted', 'success'),
            onError: (error: any) => showToast(error?.message ?? 'Could not delete', 'error'),
          }),
      },
    ]);
  };

  const markPaid = (record: SupplierPayoutRecord, method: PaymentMethod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    update.mutate(
      { id: record.id, paymentStatus: 'PAID', paymentMethod: method },
      {
        onSuccess: () => showToast(`Marked as paid by ${method.toLowerCase()}`, 'success'),
        onError: (error: any) => showToast(error?.message ?? 'Could not update', 'error'),
      },
    );
  };

  return (
    <ToolScreen title="Supplier Payouts" subtitle="Money owed & paid">
      <SegmentedTabs<StatusTab>
        options={[
          { value: 'all', label: 'All' },
          { value: 'TO_PAY', label: 'To Pay' },
          { value: 'PAID', label: 'Paid' },
        ]}
        value={statusTab}
        onChange={setStatusTab}
      />
      <SegmentedTabs<RangeTab>
        options={[
          { value: 'all', label: 'All time' },
          { value: 'today', label: 'Today' },
          { value: '7d', label: '7 days' },
          { value: '30d', label: '30 days' },
          { value: 'custom', label: 'Custom' },
        ]}
        value={range}
        onChange={setRange}
      />
      {range === 'custom' && (
        <View style={styles.dateRow}>
          <View style={styles.flex1}>
            <DateTimeField label="From" mode="date" value={customStart} onChange={setCustomStart} placeholder="Any" />
          </View>
          <View style={styles.flex1}>
            <DateTimeField label="To" mode="date" value={customEnd} onChange={setCustomEnd} placeholder="Any" />
          </View>
        </View>
      )}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={Colors.light.textLight} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search supplier or notes"
            placeholderTextColor={Colors.light.textLight}
            style={styles.searchInput}
          />
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
                <StatCard label="To pay" value={formatMoney(totals.pending)} tone="warning" />
                <StatCard label="Paid" value={formatMoney(totals.paid)} tone="success" />
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
              onPress={() => {
                setEditing(item);
                setShowForm(true);
              }}
              onLongPress={() => handleDelete(item)}
            >
              <View style={styles.recordRow}>
                <View style={styles.recordBody}>
                  <Text style={styles.recordTitle}>{item.supplier}</Text>
                  <Text style={styles.recordMeta}>
                    {item.recordedBy} · {formatDateTime(item.createdAt)}
                  </Text>
                  {!!item.notes && <Text style={styles.recordNotes}>{item.notes}</Text>}
                </View>
                <View style={styles.recordRight}>
                  <Text style={styles.recordAmount}>{formatMoney(item.amount)}</Text>
                  <StatusPill
                    label={item.paymentStatus === 'PAID' ? `PAID · ${item.paymentMethod ?? ''}` : 'TO PAY'}
                    color={item.paymentStatus === 'PAID' ? Colors.light.success : Colors.light.warning}
                  />
                </View>
              </View>
              {item.paymentStatus === 'TO_PAY' && (
                <View style={styles.quickPayRow}>
                  <QuickPay label="Paid · Cash" onPress={() => markPaid(item, 'CASH')} />
                  <QuickPay label="Paid · Card" onPress={() => markPaid(item, 'CARD')} />
                </View>
              )}
            </RecordCard>
          )}
          ListEmptyComponent={
            <EmptyState icon="cash-outline" title="No payout records" subtitle="Track what you owe your suppliers." />
          }
        />
      )}

      <Fab
        label="New Payout"
        onPress={() => {
          setEditing(null);
          setShowForm(true);
        }}
      />

      <PayoutForm
        visible={showForm}
        record={editing}
        onClose={() => setShowForm(false)}
        saving={create.isPending || update.isPending}
        onSave={(input) => {
          const mutation = editing
            ? update.mutateAsync({ id: editing.id, ...input })
            : create.mutateAsync(input);
          mutation
            .then(() => {
              setShowForm(false);
              showToast(editing ? 'Payout updated' : 'Payout recorded', 'success');
            })
            .catch((error: any) => showToast(error?.message ?? 'Could not save', 'error'));
        }}
      />
    </ToolScreen>
  );
}

function QuickPay({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PrimaryButton title={label} onPress={onPress} variant="ghost" style={styles.quickPayButton} />
  );
}

function PayoutForm({
  visible,
  record,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  record: SupplierPayoutRecord | null;
  onClose: () => void;
  onSave: (input: SupplierPayoutInput) => void;
  saving: boolean;
}) {
  const [supplier, setSupplier] = useState('');
  const [amountText, setAmountText] = useState('');
  const [status, setStatus] = useState<PaymentStatus>('TO_PAY');
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [notes, setNotes] = useState('');

  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = visible ? (record?.id ?? 'new') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setSupplier(record?.supplier ?? '');
      setAmountText(record ? Number(record.amount).toFixed(2) : '');
      setStatus(record?.paymentStatus ?? 'TO_PAY');
      setMethod(record?.paymentMethod ?? null);
      setNotes(record?.notes ?? '');
    }
  }

  const amount = parseMoneyInput(amountText);
  const valid =
    supplier.trim().length > 0 &&
    amount != null &&
    amount > 0 &&
    (status === 'TO_PAY' || method != null);

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>{record ? 'Edit Payout' : 'New Supplier Payout'}</Text>
        <TextField label="Supplier" value={supplier} onChangeText={setSupplier} placeholder="e.g. Bestway" />
        <TextField label="Amount (£)" value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder="0.00" />
        <OptionPicker<PaymentStatus>
          label="Status"
          options={[
            { value: 'TO_PAY', label: 'To Pay', color: Colors.light.warning },
            { value: 'PAID', label: 'Paid', color: Colors.light.success },
          ]}
          value={status}
          onChange={setStatus}
        />
        {status === 'PAID' && (
          <OptionPicker<PaymentMethod>
            label="Payment method"
            options={[
              { value: 'CASH', label: 'Cash' },
              { value: 'CARD', label: 'Card' },
            ]}
            value={method}
            onChange={setMethod}
          />
        )}
        <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Invoice number, terms..." />
        <PrimaryButton
          title={record ? 'Save Changes' : 'Add Record'}
          onPress={() =>
            valid &&
            onSave({
              supplier: supplier.trim(),
              amount: amount!,
              paymentStatus: status,
              paymentMethod: status === 'PAID' ? (method ?? undefined) : undefined,
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
  flex1: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
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
    alignItems: 'flex-start',
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
  recordRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  recordAmount: {
    ...Typography.price,
    color: Colors.light.text,
  },
  quickPayRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  quickPayButton: {
    flex: 1,
    paddingVertical: 8,
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
});
