import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { DateTimeField } from '@/features/shop-tools/components/date-time-field';
import { EmptyState } from '@/features/shop-tools/components/empty-state';
import { AuditLine, Fab, RecordCard, StatusPill } from '@/features/shop-tools/components/primitives';
import { OptionPicker } from '@/features/shop-tools/components/option-picker';
import { SegmentedTabs } from '@/features/shop-tools/components/segmented-tabs';
import { ListSkeleton, StatCard } from '@/features/shop-tools/components/stat-card';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import {
  formatDateTime,
  formatMoney,
  formatMoneyTyping,
  parseMoneyInput,
  toDateParam,
} from '@/features/shop-tools/format';
import {
  createWaste,
  fetchWaste,
  searchProducts,
  wasteKeys,
  type ProductSearchHit,
  type WasteInput,
  type WasteReason,
  type WasteRecord,
} from '@/features/waste/api';
import { subscribeWasteScan, type WasteScanProduct } from '@/features/waste/scan-bridge';

type Range = 'today' | '7d' | '30d' | 'custom' | 'all';

const reasonLabels: Record<WasteReason, string> = {
  DAMAGED: 'Damaged',
  NEAR_EXPIRY: 'Near expiry',
  SPOILED: 'Spoiled',
  OTHER: 'Other',
};

/** Waste ledger — records are permanent (no edit/delete on the backend). */
export default function WasteManagementScreen() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [range, setRange] = useState<Range>('30d');
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [scanned, setScanned] = useState<WasteScanProduct | null>(null);

  // Reopen the form prefilled once the scanner hands a product back.
  useEffect(
    () =>
      subscribeWasteScan((product) => {
        setScanned(product);
        setShowForm(true);
      }),
    [],
  );

  const dates = useMemo(() => {
    const now = new Date();
    if (range === 'today') return { startDate: toDateParam(now), endDate: toDateParam(now) };
    if (range === '7d' || range === '30d') {
      const start = new Date();
      start.setDate(start.getDate() - (range === '7d' ? 7 : 30));
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

  const waste = useQuery({
    queryKey: wasteKeys.list(dates),
    queryFn: () => fetchWaste({ ...dates, limit: 500 }),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: createWaste,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['waste'] }),
  });

  const topWasted = useMemo(() => {
    const byItem = new Map<string, number>();
    for (const record of waste.data?.records ?? []) {
      byItem.set(record.itemName, (byItem.get(record.itemName) ?? 0) + Number(record.quantityWasted));
    }
    return [...byItem.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [waste.data]);

  return (
    <ToolScreen title="Waste Management" subtitle="Damaged & disposed stock">
      <SegmentedTabs<Range>
        options={[
          { value: 'today', label: 'Today' },
          { value: '7d', label: '7 days' },
          { value: '30d', label: '30 days' },
          { value: 'all', label: 'All' },
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

      {waste.isLoading ? (
        <ListSkeleton rows={5} height={88} />
      ) : (
        <FlatList
          data={waste.data?.records ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.statsRow}>
              <StatCard label="Items wasted" value={String(waste.data?.summary.totalQuantity ?? 0)} />
              <StatCard label="Total loss" value={formatMoney(waste.data?.summary.totalLoss ?? 0)} tone="error" />
              {topWasted && <StatCard label="Most wasted" value={topWasted[0]} tone="warning" />}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={waste.isRefetching}
              onRefresh={waste.refetch}
              tintColor={Colors.light.primary}
            />
          }
          renderItem={({ item }) => <WasteRow record={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="trash-outline"
              title="No waste recorded"
              subtitle="Log damaged, spoiled or expired stock to track your losses."
            />
          }
        />
      )}

      <Fab label="Record Waste" onPress={() => setShowForm(true)} />

      <WasteForm
        visible={showForm}
        onClose={() => {
          setShowForm(false);
          setScanned(null);
        }}
        saving={create.isPending}
        initialProduct={scanned}
        onScan={() => {
          // The native sheet modal would cover the scanner screen, so close it
          // first; the scan-bridge subscription reopens it prefilled.
          setShowForm(false);
          router.push({ pathname: '/(app)/scanner', params: { intent: 'waste' } });
        }}
        onSave={(input) =>
          create
            .mutateAsync(input)
            .then(() => {
              setShowForm(false);
              setScanned(null);
              showToast('Waste recorded', 'success');
            })
            .catch((error: any) => showToast(error?.message ?? 'Could not save', 'error'))
        }
      />
    </ToolScreen>
  );
}

function WasteRow({ record }: { record: WasteRecord }) {
  return (
    <RecordCard>
      <View style={styles.recordRow}>
        <View style={styles.recordBody}>
          <Text style={styles.recordTitle}>{record.itemName}</Text>
          <Text style={styles.recordMeta}>
            Qty {record.quantityWasted} · {formatMoney(record.originalPrice)} each
            {record.priceReduced && record.reducedPrice != null
              ? ` → reduced to ${formatMoney(record.reducedPrice)}`
              : ''}
          </Text>
          <AuditLine
            text={`${record.disposedBy ? `By ${record.disposedBy} · ` : ''}${formatDateTime(
              record.disposedAt ?? record.createdAt,
            )}`}
          />
        </View>
        <View style={styles.recordRight}>
          <Text style={styles.lossText}>-{formatMoney(record.totalLoss)}</Text>
          {record.priceReductionReason && (
            <StatusPill
              label={reasonLabels[record.priceReductionReason] ?? record.priceReductionReason}
              color={Colors.light.warning}
            />
          )}
        </View>
      </View>
    </RecordCard>
  );
}

function WasteForm({
  visible,
  onClose,
  onSave,
  saving,
  initialProduct,
  onScan,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (input: WasteInput) => void;
  saving: boolean;
  initialProduct?: WasteScanProduct | null;
  onScan?: () => void;
}) {
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [itemName, setItemName] = useState('');
  const [quantityText, setQuantityText] = useState('1');
  const [priceText, setPriceText] = useState('');
  const [priceReduced, setPriceReduced] = useState(false);
  const [reducedPriceText, setReducedPriceText] = useState('');
  const [reason, setReason] = useState<WasteReason>('DAMAGED');
  const [reasonNote, setReasonNote] = useState('');
  const [hits, setHits] = useState<ProductSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      // Prefill from a scanned product when the scanner reopened the form.
      setProductId(initialProduct?.id);
      setItemName(initialProduct?.title ?? '');
      setQuantityText('1');
      setPriceText(initialProduct?.price != null ? Number(initialProduct.price).toFixed(2) : '');
      setPriceReduced(false);
      setReducedPriceText('');
      setReason('DAMAGED');
      setReasonNote('');
      setHits([]);
    }
  }

  // Debounced product lookup while typing the item name.
  useEffect(() => {
    if (!visible || productId || itemName.trim().length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchProducts(itemName.trim())
        .then((results) => setHits(results.slice(0, 5)))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [itemName, productId, visible]);

  const quantity = Number(quantityText);
  const price = parseMoneyInput(priceText);
  const reducedPrice = parseMoneyInput(reducedPriceText);
  const valid =
    itemName.trim().length > 0 &&
    Number.isFinite(quantity) &&
    quantity > 0 &&
    price != null &&
    price >= 0 &&
    (!priceReduced || (reducedPrice != null && reducedPrice >= 0));

  const projectedLoss = valid ? quantity * (price ?? 0) : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware scrollable>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Record Waste</Text>
        <TextField
          label="Item"
          value={itemName}
          onChangeText={(text) => {
            setItemName(text);
            setProductId(undefined);
          }}
          placeholder="Search or type item name"
        />
        {onScan && (
          <Pressable
            onPress={onScan}
            style={({ pressed }) => [styles.scanButton, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="scan" size={16} color={Colors.light.primary} />
            <Text style={styles.scanButtonText}>Scan barcode instead</Text>
          </Pressable>
        )}
        {hits.length > 0 && (
          <View style={styles.hitsBox}>
            {hits.map((hit) => (
              <Pressable
                key={hit.id}
                style={styles.hitRow}
                onPress={() => {
                  setProductId(hit.id);
                  setItemName(hit.title);
                  if (hit.rrp != null && !priceText) setPriceText(Number(hit.rrp).toFixed(2));
                  setHits([]);
                }}
              >
                <Ionicons name="cube-outline" size={16} color={Colors.light.primary} />
                <Text style={styles.hitText} numberOfLines={1}>
                  {hit.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {searching && <Text style={styles.searchingText}>Searching products…</Text>}
        <View style={styles.dateTimeRow}>
          <View style={styles.flex1}>
            <TextField label="Quantity" value={quantityText} onChangeText={setQuantityText} keyboardType="number-pad" />
          </View>
          <View style={styles.flex1}>
            <TextField label="Price each (£)" value={priceText} onChangeText={(text) => setPriceText(formatMoneyTyping(text))} keyboardType="decimal-pad" placeholder="0.00" />
          </View>
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Was the price reduced first?</Text>
          <Switch
            value={priceReduced}
            onValueChange={setPriceReduced}
            trackColor={{ true: Colors.light.primary }}
          />
        </View>
        {priceReduced && (
          <TextField
            label="Reduced price (£)"
            value={reducedPriceText}
            onChangeText={(text) => setReducedPriceText(formatMoneyTyping(text))}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        )}
        <OptionPicker<WasteReason>
          label="Reason"
          options={[
            { value: 'DAMAGED', label: 'Damaged' },
            { value: 'NEAR_EXPIRY', label: 'Near expiry' },
            { value: 'SPOILED', label: 'Spoiled' },
            { value: 'OTHER', label: 'Other' },
          ]}
          value={reason}
          onChange={setReason}
        />
        {reason === 'OTHER' && (
          <TextField label="Reason note" value={reasonNote} onChangeText={setReasonNote} placeholder="What happened?" />
        )}
        {projectedLoss != null && (
          <Text style={styles.lossPreview}>Estimated loss: {formatMoney(projectedLoss)}</Text>
        )}
        <PrimaryButton
          title="Add Record"
          onPress={() =>
            valid &&
            onSave({
              productId,
              itemName: itemName.trim(),
              quantityWasted: quantity,
              originalPrice: price!,
              reducedPrice: priceReduced ? (reducedPrice ?? undefined) : undefined,
              priceReduced,
              priceReductionReason: reason,
              priceReductionReasonNote: reasonNote.trim() || undefined,
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
  recordRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  lossText: {
    ...Typography.price,
    color: Colors.light.error,
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
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    marginTop: -Spacing.xs,
  },
  scanButtonText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  hitsBox: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundCard,
    overflow: 'hidden',
  },
  hitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  hitText: {
    ...Typography.bodySmall,
    color: Colors.light.text,
    flex: 1,
  },
  searchingText: {
    ...Typography.caption,
    color: Colors.light.textLight,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    ...Typography.body,
    color: Colors.light.text,
    flex: 1,
  },
  lossPreview: {
    ...Typography.bodyBold,
    color: Colors.light.error,
    textAlign: 'center',
  },
});
