import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import {
  useAddTemperatureLog,
  useAllLogs,
  useFridgeMutations,
  useFridges,
  useTodayStatus,
} from '@/features/fridges/hooks/use-fridges';
import type { Compartment, EntrySlot, Fridge, FridgeTodayStatus } from '@/features/fridges/types';
import { EmptyState } from '@/features/shop-tools/components/empty-state';
import { Fab, RecordCard, StatusPill } from '@/features/shop-tools/components/primitives';
import { SegmentedTabs } from '@/features/shop-tools/components/segmented-tabs';
import { ListSkeleton } from '@/features/shop-tools/components/stat-card';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { useIsOwner } from '@/features/shop-tools/hooks/use-is-owner';
import { formatDateTime, toDateParam } from '@/features/shop-tools/format';

type Tab = 'today' | 'history' | 'equipment';
type Range = '7d' | '30d' | 'all';

interface LogTarget {
  fridge: FridgeTodayStatus;
  slot: EntrySlot;
  compartment: Compartment;
}

/** Chiller/freezer temperature logging with per-day morning/evening checklist. */
export default function FridgeTemperatureScreen() {
  const isOwner = useIsOwner();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('today');
  const [range, setRange] = useState<Range>('7d');
  const [historyFridgeId, setHistoryFridgeId] = useState<string | undefined>(undefined);
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const [editingFridge, setEditingFridge] = useState<Fridge | null>(null);
  const [showFridgeSheet, setShowFridgeSheet] = useState(false);

  const todayStatus = useTodayStatus();
  const fridges = useFridges(true);
  const historyFilters = useMemo(() => {
    if (range === 'all') return { fridgeId: historyFridgeId };
    const start = new Date();
    start.setDate(start.getDate() - (range === '7d' ? 7 : 30));
    return { fridgeId: historyFridgeId, startDate: toDateParam(start) };
  }, [range, historyFridgeId]);
  const logs = useAllLogs(historyFilters);
  const addLog = useAddTemperatureLog();
  const fridgeMutations = useFridgeMutations();

  const tabs = [
    { value: 'today' as Tab, label: 'Today' },
    { value: 'history' as Tab, label: 'History' },
    ...(isOwner ? [{ value: 'equipment' as Tab, label: 'Equipment', count: fridges.data?.length }] : []),
  ];

  const handleDeleteFridge = (fridge: Fridge) => {
    Alert.alert('Delete equipment', `Remove "${fridge.name}" and all its temperature logs?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          fridgeMutations.remove.mutate(fridge.id, {
            onSuccess: () => showToast('Equipment deleted', 'success'),
            onError: (error: any) => showToast(error?.message ?? 'Could not delete', 'error'),
          }),
      },
    ]);
  };

  return (
    <ToolScreen title="Temperature Log" subtitle="Chillers & freezers">
      <SegmentedTabs options={tabs} value={tab} onChange={setTab} />

      {tab === 'today' &&
        (todayStatus.isLoading ? (
          <ListSkeleton rows={3} height={150} />
        ) : (
          <FlatList
            data={todayStatus.data ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={todayStatus.isRefetching}
                onRefresh={todayStatus.refetch}
                tintColor={Colors.light.primary}
              />
            }
            renderItem={({ item }) => (
              <TodayFridgeCard fridge={item} onLog={(slot, compartment) => setLogTarget({ fridge: item, slot, compartment })} />
            )}
            ListEmptyComponent={
              <EmptyState
                icon="thermometer-outline"
                title="No equipment yet"
                subtitle={
                  isOwner
                    ? 'Add your chillers and freezers to start logging temperatures.'
                    : 'The shop owner has not added any equipment yet.'
                }
              />
            }
          />
        ))}

      {tab === 'history' && (
        <>
          <View style={styles.filterRow}>
            {(['7d', '30d', 'all'] as Range[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => setRange(r)}
                style={[styles.rangeChip, range === r && styles.rangeChipSelected]}
              >
                <Text style={[styles.rangeChipText, range === r && styles.rangeChipTextSelected]}>
                  {r === '7d' ? '7 days' : r === '30d' ? '30 days' : 'All'}
                </Text>
              </Pressable>
            ))}
            {(fridges.data ?? []).map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setHistoryFridgeId(historyFridgeId === f.id ? undefined : f.id)}
                style={[styles.rangeChip, historyFridgeId === f.id && styles.rangeChipSelected]}
              >
                <Text
                  style={[styles.rangeChipText, historyFridgeId === f.id && styles.rangeChipTextSelected]}
                  numberOfLines={1}
                >
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {logs.isLoading ? (
            <ListSkeleton rows={6} height={60} />
          ) : (
            <FlatList
              data={logs.data ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={<TempChart logs={logs.data ?? []} />}
              refreshControl={
                <RefreshControl
                  refreshing={logs.isRefetching}
                  onRefresh={logs.refetch}
                  tintColor={Colors.light.primary}
                />
              }
              renderItem={({ item }) => (
                <RecordCard style={item.isAlert ? styles.alertCard : undefined}>
                  <View style={styles.logRow}>
                    <View style={styles.logBody}>
                      <Text style={styles.logTitle}>
                        {item.fridgeName ?? ''} · {item.compartment === 'FREEZER' ? 'Freezer' : 'Chiller'} ·{' '}
                        {item.entryType === 'MORNING' ? 'Morning' : 'Evening'}
                      </Text>
                      <Text style={styles.logMeta}>
                        {item.recordedByName ?? '—'} · {formatDateTime(item.recordedAt)}
                      </Text>
                      {!!item.alertMessage && <Text style={styles.alertText}>{item.alertMessage}</Text>}
                    </View>
                    <Text style={[styles.logTemp, item.isAlert && { color: Colors.light.error }]}>
                      {Number(item.temperature).toFixed(1)}°C
                    </Text>
                  </View>
                </RecordCard>
              )}
              ListEmptyComponent={
                <EmptyState icon="analytics-outline" title="No readings" subtitle="Logged temperatures appear here." />
              }
            />
          )}
        </>
      )}

      {tab === 'equipment' && isOwner && (
        <>
          <FlatList
            data={fridges.data ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <RecordCard
                onPress={() => {
                  setEditingFridge(item);
                  setShowFridgeSheet(true);
                }}
                onLongPress={() => handleDeleteFridge(item)}
              >
                <View style={styles.logRow}>
                  <View style={styles.logBody}>
                    <Text style={styles.logTitle}>{item.name}</Text>
                    <Text style={styles.logMeta}>
                      {item.location ? `${item.location} · ` : ''}
                      Chiller {item.minSafeTemp}° to {item.maxSafeTemp}°C
                      {item.hasFreezer ? ` · Freezer ${item.freezerMinSafeTemp}° to ${item.freezerMaxSafeTemp}°C` : ''}
                    </Text>
                  </View>
                  {!item.isActive && <StatusPill label="INACTIVE" color={Colors.light.warning} />}
                  <Ionicons name="chevron-forward" size={16} color={Colors.light.textLight} />
                </View>
              </RecordCard>
            )}
            ListEmptyComponent={
              <EmptyState icon="snow-outline" title="No equipment" subtitle="Add your first chiller or freezer." />
            }
          />
          <Fab
            label="Add Equipment"
            onPress={() => {
              setEditingFridge(null);
              setShowFridgeSheet(true);
            }}
          />
        </>
      )}

      <LogTemperatureSheet
        target={logTarget}
        onClose={() => setLogTarget(null)}
        saving={addLog.isPending}
        onSave={(temperature, notes) => {
          if (!logTarget) return;
          addLog.mutate(
            {
              fridgeId: logTarget.fridge.id,
              temperature,
              entryType: logTarget.slot,
              compartment: logTarget.compartment,
              notes,
            },
            {
              onSuccess: (log) => {
                setLogTarget(null);
                if (log?.isAlert) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  showToast(log.alertMessage ?? 'Temperature out of safe range!', 'error');
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  showToast('Reading saved', 'success');
                }
              },
              onError: (error: any) => showToast(error?.message ?? 'Could not save', 'error'),
            },
          );
        }}
      />

      <FridgeFormSheet
        visible={showFridgeSheet}
        fridge={editingFridge}
        onClose={() => setShowFridgeSheet(false)}
        saving={fridgeMutations.create.isPending || fridgeMutations.update.isPending}
        onSave={(input) => {
          const mutation = editingFridge
            ? fridgeMutations.update.mutateAsync({ id: editingFridge.id, ...input })
            : fridgeMutations.create.mutateAsync(input);
          mutation
            .then(() => {
              setShowFridgeSheet(false);
              showToast(editingFridge ? 'Equipment updated' : 'Equipment added', 'success');
            })
            .catch((error: any) => showToast(error?.message ?? 'Could not save', 'error'));
        }}
      />
    </ToolScreen>
  );
}

/** Today card: morning/evening slots per compartment, red when out of range. */
function TodayFridgeCard({
  fridge,
  onLog,
}: {
  fridge: FridgeTodayStatus;
  onLog: (slot: EntrySlot, compartment: Compartment) => void;
}) {
  const freezerOnly =
    !fridge.hasFreezer && fridge.minSafeTemp <= -11 && fridge.maxSafeTemp <= -11;

  const slot = (
    label: string,
    logged: boolean,
    temp: number | null | undefined,
    slotType: EntrySlot,
    compartment: Compartment,
    min: number,
    max: number,
  ) => {
    const isAlert = logged && temp != null && (temp < min || temp > max);
    return (
      <Pressable
        key={`${compartment}-${slotType}`}
        onPress={() => !logged && onLog(slotType, compartment)}
        style={[styles.slot, logged && styles.slotDone, isAlert && styles.slotAlert]}
      >
        <Text style={styles.slotLabel}>{label}</Text>
        {logged ? (
          <Text style={[styles.slotTemp, isAlert && { color: Colors.light.error }]}>
            {Number(temp).toFixed(1)}°C
          </Text>
        ) : (
          <View style={styles.slotAdd}>
            <Ionicons name="add" size={14} color={Colors.light.primary} />
            <Text style={styles.slotAddText}>Log</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <RecordCard>
      <View style={styles.fridgeHeader}>
        <View style={styles.fridgeIcon}>
          <Ionicons name={freezerOnly ? 'snow-outline' : 'thermometer-outline'} size={18} color={Colors.light.primary} />
        </View>
        <View style={styles.logBody}>
          <Text style={styles.logTitle}>{fridge.name}</Text>
          {!!fridge.location && <Text style={styles.logMeta}>{fridge.location}</Text>}
        </View>
      </View>

      {!freezerOnly && (
        <View style={styles.slotSection}>
          <Text style={styles.slotSectionLabel}>
            Chiller ({fridge.minSafeTemp}° to {fridge.maxSafeTemp}°C)
          </Text>
          <View style={styles.slotRow}>
            {slot('Morning', fridge.morningFridgeLogged, fridge.morningFridgeTemp, 'MORNING', 'FRIDGE', fridge.minSafeTemp, fridge.maxSafeTemp)}
            {slot('Evening', fridge.eveningFridgeLogged, fridge.eveningFridgeTemp, 'EVENING', 'FRIDGE', fridge.minSafeTemp, fridge.maxSafeTemp)}
          </View>
        </View>
      )}

      {(fridge.hasFreezer || freezerOnly) && (
        <View style={styles.slotSection}>
          <Text style={styles.slotSectionLabel}>
            Freezer ({fridge.freezerMinSafeTemp ?? fridge.minSafeTemp}° to {fridge.freezerMaxSafeTemp ?? fridge.maxSafeTemp}
            °C)
          </Text>
          <View style={styles.slotRow}>
            {freezerOnly
              ? [
                  slot('Morning', fridge.morningFridgeLogged, fridge.morningFridgeTemp, 'MORNING', 'FREEZER', fridge.minSafeTemp, fridge.maxSafeTemp),
                  slot('Evening', fridge.eveningFridgeLogged, fridge.eveningFridgeTemp, 'EVENING', 'FREEZER', fridge.minSafeTemp, fridge.maxSafeTemp),
                ]
              : [
                  slot('Morning', fridge.morningFreezerLogged, fridge.morningFreezerTemp, 'MORNING', 'FREEZER', fridge.freezerMinSafeTemp ?? -17, fridge.freezerMaxSafeTemp ?? -11),
                  slot('Evening', fridge.eveningFreezerLogged, fridge.eveningFreezerTemp, 'EVENING', 'FREEZER', fridge.freezerMinSafeTemp ?? -17, fridge.freezerMaxSafeTemp ?? -11),
                ]}
          </View>
        </View>
      )}
    </RecordCard>
  );
}

/** Minimal bar chart of the loaded readings (most recent 14). */
function TempChart({ logs }: { logs: { temperature: string | number; isAlert?: boolean }[] }) {
  const recent = logs.slice(0, 14).reverse();
  if (recent.length < 2) return null;
  const temps = recent.map((l) => Number(l.temperature));
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = max - min || 1;
  return (
    <View style={styles.chartCard}>
      <Text style={styles.slotSectionLabel}>Recent readings</Text>
      <View style={styles.chartRow}>
        {recent.map((log, i) => {
          const t = Number(log.temperature);
          const h = 12 + ((t - min) / span) * 48;
          return (
            <View key={i} style={styles.chartCol}>
              <View
                style={[
                  styles.chartBar,
                  { height: h },
                  log.isAlert && { backgroundColor: Colors.light.error },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.chartLegend}>
        <Text style={styles.chartLegendText}>{min.toFixed(1)}°C min</Text>
        <Text style={styles.chartLegendText}>{max.toFixed(1)}°C max</Text>
      </View>
    </View>
  );
}

function LogTemperatureSheet({
  target,
  onClose,
  onSave,
  saving,
}: {
  target: LogTarget | null;
  onClose: () => void;
  onSave: (temperature: number, notes?: string) => void;
  saving: boolean;
}) {
  const [tempText, setTempText] = useState('');
  const [notes, setNotes] = useState('');
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = target ? `${target.fridge.id}-${target.slot}-${target.compartment}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    setTempText('');
    setNotes('');
  }

  const temp = tempText.trim() === '' || tempText.trim() === '-' ? null : Number(tempText);
  const valid = temp != null && Number.isFinite(temp);

  return (
    <BottomSheet visible={target != null} onClose={onClose} keyboardAware>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>
          {target
            ? `${target.fridge.name} · ${target.compartment === 'FREEZER' ? 'Freezer' : 'Chiller'} · ${
                target.slot === 'MORNING' ? 'Morning' : 'Evening'
              }`
            : ''}
        </Text>
        <TextField
          label="Temperature (°C)"
          value={tempText}
          onChangeText={setTempText}
          placeholder="e.g. 3.5"
          keyboardType="numbers-and-punctuation"
          autoFocus
        />
        <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything unusual?" />
        <PrimaryButton
          title="Save Reading"
          onPress={() => valid && onSave(temp!, notes.trim() || undefined)}
          disabled={!valid}
          loading={saving}
        />
      </View>
    </BottomSheet>
  );
}

function FridgeFormSheet({
  visible,
  fridge,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  fridge: Fridge | null;
  onClose: () => void;
  onSave: (input: {
    name: string;
    location?: string;
    minSafeTemp?: number;
    maxSafeTemp?: number;
    hasFreezer?: boolean;
    isActive?: boolean;
  }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [minTemp, setMinTemp] = useState('-5');
  const [maxTemp, setMaxTemp] = useState('8');
  const [hasFreezer, setHasFreezer] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = visible ? (fridge?.id ?? 'new') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setName(fridge?.name ?? '');
      setLocation(fridge?.location ?? '');
      setMinTemp(String(fridge?.minSafeTemp ?? -5));
      setMaxTemp(String(fridge?.maxSafeTemp ?? 8));
      setHasFreezer(fridge?.hasFreezer ?? false);
      setIsActive(fridge?.isActive ?? true);
    }
  }

  const min = Number(minTemp);
  const max = Number(maxTemp);
  const valid = name.trim().length > 0 && Number.isFinite(min) && Number.isFinite(max) && min < max;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>{fridge ? 'Edit Equipment' : 'New Equipment'}</Text>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Drinks Chiller" />
        <TextField label="Location (optional)" value={location} onChangeText={setLocation} placeholder="e.g. Back room" />
        <View style={styles.tempRow}>
          <View style={styles.tempField}>
            <TextField label="Min safe °C" value={minTemp} onChangeText={setMinTemp} keyboardType="numbers-and-punctuation" />
          </View>
          <View style={styles.tempField}>
            <TextField label="Max safe °C" value={maxTemp} onChangeText={setMaxTemp} keyboardType="numbers-and-punctuation" />
          </View>
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Has freezer compartment</Text>
          <Switch
            value={hasFreezer}
            onValueChange={setHasFreezer}
            trackColor={{ true: Colors.light.primary }}
          />
        </View>
        {fridge && (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Active</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: Colors.light.primary }} />
          </View>
        )}
        <PrimaryButton
          title={fridge ? 'Save Changes' : 'Add Equipment'}
          onPress={() =>
            valid &&
            onSave({
              name: name.trim(),
              location: location.trim() || undefined,
              minSafeTemp: min,
              maxSafeTemp: max,
              hasFreezer,
              ...(fridge ? { isActive } : {}),
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
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  rangeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundCard,
    maxWidth: 160,
  },
  rangeChipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  rangeChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  rangeChipTextSelected: {
    color: '#FFFFFF',
  },
  fridgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  fridgeIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotSection: {
    marginTop: Spacing.xs,
    gap: 6,
  },
  slotSectionLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  slotRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  slot: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  slotDone: {
    backgroundColor: Colors.light.backgroundCard,
  },
  slotAlert: {
    borderColor: Colors.light.error,
    backgroundColor: '#B9382A10',
  },
  slotLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  slotTemp: {
    ...Typography.bodyBold,
    color: Colors.light.success,
  },
  slotAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  slotAddText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logBody: {
    flex: 1,
    gap: 2,
  },
  logTitle: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  logMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  logTemp: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  alertCard: {
    borderColor: Colors.light.error,
  },
  alertText: {
    ...Typography.caption,
    color: Colors.light.error,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 64,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '70%',
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartLegendText: {
    ...Typography.caption,
    color: Colors.light.textLight,
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
  tempRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tempField: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    ...Typography.body,
    color: Colors.light.text,
  },
});
