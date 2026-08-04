import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAreaMutations,
  useCleaningAreas,
  useCleaningHistory,
  useCleaningToday,
  useToggleCleaned,
} from '@/features/cleaning/hooks/use-cleaning';
import type { CleaningArea, CleaningAreaStatus } from '@/features/cleaning/types';
import { EmptyState } from '@/features/shop-tools/components/empty-state';
import { AuditLine, Fab, RecordCard } from '@/features/shop-tools/components/primitives';
import { SegmentedTabs } from '@/features/shop-tools/components/segmented-tabs';
import { ListSkeleton } from '@/features/shop-tools/components/stat-card';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { useIsOwner } from '@/features/shop-tools/hooks/use-is-owner';
import { formatDateTime, formatTime } from '@/features/shop-tools/format';

type Tab = 'today' | 'history' | 'areas';

/** Daily cleaning checklist + history; owners also manage the area list. */
export default function CleaningStatusScreen() {
  const isOwner = useIsOwner();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('today');
  const [editingArea, setEditingArea] = useState<CleaningArea | null>(null);
  const [showAreaSheet, setShowAreaSheet] = useState(false);

  const today = useCleaningToday();
  const history = useCleaningHistory({});
  const areas = useCleaningAreas(true);
  const toggle = useToggleCleaned(user?.name ?? 'You');
  const areaMutations = useAreaMutations();

  const tabs = [
    { value: 'today' as Tab, label: 'Today', count: today.data?.summary.totalCount },
    { value: 'history' as Tab, label: 'History' },
    ...(isOwner ? [{ value: 'areas' as Tab, label: 'Areas', count: areas.data?.length }] : []),
  ];

  const handleToggle = (area: CleaningAreaStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggle.mutate(
      { areaId: area.id, complete: !area.isCompleted },
      { onError: (error: any) => showToast(error?.message ?? 'Something went wrong', 'error') },
    );
  };

  const handleDeleteArea = (area: CleaningArea) => {
    Alert.alert('Delete area', `Remove "${area.name}" and its checklist entry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          areaMutations.remove.mutate(area.id, {
            onSuccess: () => showToast('Area deleted', 'success'),
            onError: (error: any) => showToast(error?.message ?? 'Could not delete', 'error'),
          }),
      },
    ]);
  };

  const summary = today.data?.summary;

  return (
    <ToolScreen title="Cleaning Status" subtitle="Daily checklist">
      <SegmentedTabs options={tabs} value={tab} onChange={setTab} />

      {tab === 'today' && (
        <>
          {summary && summary.totalCount > 0 && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  {summary.completedCount} of {summary.totalCount} areas cleaned
                </Text>
                <Text style={styles.progressPct}>{summary.percentage}%</Text>
              </View>
              <ProgressBar progress={summary.totalCount ? summary.completedCount / summary.totalCount : 0} />
            </View>
          )}
          {today.isLoading ? (
            <ListSkeleton rows={5} height={64} />
          ) : (
            <FlatList
              data={today.data?.areas ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={today.isRefetching}
                  onRefresh={today.refetch}
                  tintColor={Colors.light.primary}
                />
              }
              renderItem={({ item }) => (
                <RecordCard onPress={() => handleToggle(item)} style={styles.rowCard}>
                  <View style={styles.rowInner}>
                    <View style={[styles.checkbox, item.isCompleted && styles.checkboxDone]}>
                      {item.isCompleted && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, item.isCompleted && styles.rowTitleDone]}>
                        {item.name}
                      </Text>
                      {item.isCompleted ? (
                        <Text style={styles.rowMeta}>
                          Cleaned by {item.completedBy ?? '—'} · {formatTime(item.completedAt)}
                        </Text>
                      ) : (
                        !!item.description && <Text style={styles.rowMeta}>{item.description}</Text>
                      )}
                    </View>
                    {item.isCompleted && (
                      <Text style={styles.undoHint}>Tap to undo</Text>
                    )}
                  </View>
                </RecordCard>
              )}
              ListEmptyComponent={
                <EmptyState
                  icon="sparkles-outline"
                  title="No cleaning areas yet"
                  subtitle={
                    isOwner
                      ? 'Add areas like Floor, Shelves or Kitchen to build the daily checklist.'
                      : 'The shop owner has not set up cleaning areas yet.'
                  }
                />
              }
            />
          )}
        </>
      )}

      {tab === 'history' &&
        (history.isLoading ? (
          <ListSkeleton rows={6} height={64} />
        ) : (
          <FlatList
            data={history.data ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={history.isRefetching}
                onRefresh={history.refetch}
                tintColor={Colors.light.primary}
              />
            }
            renderItem={({ item }) => (
              <RecordCard style={styles.rowCard}>
                <Text style={styles.rowTitle}>{item.areaName}</Text>
                {!!item.notes && <Text style={styles.rowMeta}>{item.notes}</Text>}
                <AuditLine text={`Cleaned by ${item.completedByName} · ${formatDateTime(item.completedAt)}`} />
              </RecordCard>
            )}
            ListEmptyComponent={
              <EmptyState icon="time-outline" title="No history yet" subtitle="Completed cleanings appear here." />
            }
          />
        ))}

      {tab === 'areas' && isOwner && (
        <>
          <FlatList
            data={areas.data ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <RecordCard
                onPress={() => {
                  setEditingArea(item);
                  setShowAreaSheet(true);
                }}
                onLongPress={() => handleDeleteArea(item)}
                style={styles.rowCard}
              >
                <View style={styles.rowInner}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    {!!item.description && <Text style={styles.rowMeta}>{item.description}</Text>}
                  </View>
                  {!item.isActive && <Text style={styles.inactivePill}>Inactive</Text>}
                  <Ionicons name="chevron-forward" size={16} color={Colors.light.textLight} />
                </View>
              </RecordCard>
            )}
            ListEmptyComponent={
              <EmptyState icon="grid-outline" title="No areas yet" subtitle="Add your first cleaning area." />
            }
          />
          <Fab
            label="Add Area"
            onPress={() => {
              setEditingArea(null);
              setShowAreaSheet(true);
            }}
          />
        </>
      )}

      <AreaFormSheet
        visible={showAreaSheet}
        area={editingArea}
        onClose={() => setShowAreaSheet(false)}
        onSave={(input) => {
          const mutation = editingArea
            ? areaMutations.update.mutateAsync({ id: editingArea.id, ...input })
            : areaMutations.create.mutateAsync(input);
          mutation
            .then(() => {
              setShowAreaSheet(false);
              showToast(editingArea ? 'Area updated' : 'Area added', 'success');
            })
            .catch((error: any) => showToast(error?.message ?? 'Could not save', 'error'));
        }}
        saving={areaMutations.create.isPending || areaMutations.update.isPending}
      />
    </ToolScreen>
  );
}

function AreaFormSheet({
  visible,
  area,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  area: CleaningArea | null;
  onClose: () => void;
  onSave: (input: { name: string; description?: string; isActive?: boolean }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Sync form when the sheet target changes.
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = visible ? (area?.id ?? 'new') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setName(area?.name ?? '');
      setDescription(area?.description ?? '');
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>{area ? 'Edit Area' : 'New Cleaning Area'}</Text>
        <TextField label="Area name" value={name} onChangeText={setName} placeholder="e.g. Kitchen" />
        <TextField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What needs cleaning?"
        />
        <PrimaryButton
          title={area ? 'Save Changes' : 'Add Area'}
          onPress={() => {
            if (!name.trim()) return;
            onSave({ name: name.trim(), description: description.trim() || undefined });
          }}
          disabled={!name.trim()}
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
  progressCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  progressPct: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
  rowCard: {
    gap: 2,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: Colors.light.success,
    borderColor: Colors.light.success,
  },
  rowTitle: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  rowTitleDone: {
    color: Colors.light.textSecondary,
  },
  rowMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  undoHint: {
    ...Typography.caption,
    color: Colors.light.textLight,
  },
  inactivePill: {
    ...Typography.caption,
    color: Colors.light.warning,
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
});
