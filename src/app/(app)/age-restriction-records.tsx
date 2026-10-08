import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ImageViewer } from '@/components/ui/image-viewer';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import {
  AGE_RESTRICTION_DESCRIPTION_MAX,
  ageRestrictionKeys,
  createAgeRestrictionRecord,
  deleteAgeRestrictionRecord,
  fetchAgeRestrictionRecords,
  updateAgeRestrictionRecord,
  type AgeRestrictionInput,
  type AgeRestrictionRecord,
} from '@/features/age-restriction/api';
import { DateTimeField } from '@/features/shop-tools/components/date-time-field';
import { EmptyState } from '@/features/shop-tools/components/empty-state';
import { AuditLine, Fab, RecordCard } from '@/features/shop-tools/components/primitives';
import { SegmentedTabs } from '@/features/shop-tools/components/segmented-tabs';
import { ListSkeleton } from '@/features/shop-tools/components/stat-card';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { formatDate, formatTime } from '@/features/shop-tools/format';

type Range = 'today' | 'week' | 'month' | 'all';

type SheetState =
  | { mode: 'view'; record: AgeRestrictionRecord }
  | { mode: 'edit'; record: AgeRestrictionRecord | null; formKey: number }
  | null;

function rangeStart(range: Range): string | undefined {
  if (range === 'all') return undefined;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (range === 'week') start.setDate(start.getDate() - 6);
  if (range === 'month') start.setDate(start.getDate() - 29);
  return start.toISOString();
}

function auditText(record: AgeRestrictionRecord): string {
  return `Recorded by ${record.createdByName ?? 'Unknown'}${
    record.updatedByName ? ` · Updated by ${record.updatedByName}` : ''
  }`;
}

/** Age restriction records: log refused sales / ID checks with date, time, note and optional photo. */
export default function AgeRestrictionRecordsScreen() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<Range>('all');
  const [sheet, setSheet] = useState<SheetState>(null);
  // Last non-null sheet, so content stays rendered while the sheet animates closed.
  const [shown, setShown] = useState<SheetState>(null);
  if (sheet && sheet !== shown) setShown(sheet);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const formSeq = useRef(0);
  const openForm = (record: AgeRestrictionRecord | null) =>
    setSheet({ mode: 'edit', record, formKey: ++formSeq.current });

  const filters = useMemo(() => ({ from: rangeStart(range) }), [range]);
  const records = useQuery({
    queryKey: ageRestrictionKeys.list(filters),
    queryFn: () => fetchAgeRestrictionRecords({ ...filters, limit: 500 }),
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ageRestrictionKeys.all });
  const create = useMutation({ mutationFn: createAgeRestrictionRecord, onSettled: invalidate });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AgeRestrictionInput }) =>
      updateAgeRestrictionRecord(id, input),
    onSettled: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteAgeRestrictionRecord, onSettled: invalidate });

  const handleDelete = (record: AgeRestrictionRecord) => {
    Alert.alert('Delete record', 'This record and its photo will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(record.id, {
            onSuccess: () => {
              setSheet(null);
              showToast('Record deleted', 'success');
            },
            onError: (error: any) => showToast(error?.message ?? 'Could not delete', 'error'),
          }),
      },
    ]);
  };

  const handleSave = (input: AgeRestrictionInput) => {
    const editing = sheet?.mode === 'edit' ? sheet.record : null;
    const mutation = editing
      ? update.mutateAsync({ id: editing.id, input })
      : create.mutateAsync(input);
    mutation
      .then((saved) => {
        setSheet(editing ? { mode: 'view', record: saved } : null);
        showToast(editing ? 'Record updated' : 'Record added', 'success');
      })
      .catch((error: any) => showToast(error?.message ?? 'Could not save', 'error'));
  };

  const list = records.data ?? [];

  return (
    <ToolScreen title="Age Restriction Records" subtitle="Refused sales & ID checks">
      <SegmentedTabs<Range>
        options={[
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'Last 7 Days' },
          { value: 'month', label: 'Last 30 Days' },
          { value: 'all', label: 'All' },
        ]}
        value={range}
        onChange={setRange}
      />

      {records.isLoading ? (
        <ListSkeleton rows={5} height={88} />
      ) : records.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load records"
          subtitle={(records.error as Error)?.message ?? 'Check your connection and try again.'}
        >
          <PrimaryButton title="Try Again" variant="ghost" onPress={() => records.refetch()} />
        </EmptyState>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={records.isRefetching}
              onRefresh={records.refetch}
              tintColor={Colors.light.primary}
            />
          }
          ListHeaderComponent={
            list.length ? (
              <Text style={styles.countText}>
                {list.length} {list.length === 1 ? 'record' : 'records'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <RecordCard
              onPress={() => setSheet({ mode: 'view', record: item })}
              onLongPress={item.canManage ? () => handleDelete(item) : undefined}
            >
              <View style={styles.row}>
                <View style={styles.body}>
                  <View style={styles.whenRow}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.light.primary} />
                    <Text style={styles.whenText}>{formatDate(item.occurredAt)}</Text>
                    <Ionicons name="time-outline" size={14} color={Colors.light.primary} />
                    <Text style={styles.whenText}>{formatTime(item.occurredAt)}</Text>
                  </View>
                  <Text style={styles.description} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <AuditLine text={auditText(item)} />
                </View>
                {!!item.imageUrl && (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="cover" />
                )}
                <Ionicons name="chevron-forward" size={18} color={Colors.light.textLight} />
              </View>
            </RecordCard>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="shield-checkmark-outline"
              title={range === 'all' ? 'No records yet' : 'No records in this period'}
              subtitle="Log refused sales and ID checks for age-restricted products so there's always a record."
            />
          }
        />
      )}

      <Fab label="Add Record" onPress={() => openForm(null)} />

      <BottomSheet visible={sheet != null} onClose={() => setSheet(null)} keyboardAware scrollable>
        {shown?.mode === 'view' && (
          <RecordDetail
            record={shown.record}
            onViewImage={setViewerUri}
            onEdit={() => openForm(shown.record)}
            onDelete={() => handleDelete(shown.record)}
            deleting={remove.isPending}
          />
        )}
        {shown?.mode === 'edit' && (
          <RecordForm
            key={shown.formKey}
            record={shown.record}
            saving={create.isPending || update.isPending}
            onSave={handleSave}
            onCancel={() => setSheet(shown.record ? { mode: 'view', record: shown.record } : null)}
          />
        )}
        {/* Must live inside the sheet's Modal: iOS can't present a sibling Modal over an open one. */}
        <ImageViewer uri={viewerUri} visible={viewerUri != null} onClose={() => setViewerUri(null)} />
      </BottomSheet>
    </ToolScreen>
  );
}

function RecordDetail({
  record,
  onViewImage,
  onEdit,
  onDelete,
  deleting,
}: {
  record: AgeRestrictionRecord;
  onViewImage: (uri: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <View style={styles.sheetContent}>
      <Text style={styles.sheetTitle}>Age Restriction Record</Text>
      <View style={styles.dateTimeRow}>
        <View style={styles.infoTile}>
          <Text style={styles.infoLabel}>Date</Text>
          <View style={styles.infoValueRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.light.primary} />
            <Text style={styles.infoValue}>{formatDate(record.occurredAt)}</Text>
          </View>
        </View>
        <View style={styles.infoTile}>
          <Text style={styles.infoLabel}>Time</Text>
          <View style={styles.infoValueRow}>
            <Ionicons name="time-outline" size={16} color={Colors.light.primary} />
            <Text style={styles.infoValue}>{formatTime(record.occurredAt)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.infoLabel}>Description</Text>
        <Text style={styles.detailDescription} selectable>
          {record.description}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.infoLabel}>Photo</Text>
        {record.imageUrl ? (
          <Pressable
            onPress={() => onViewImage(record.imageUrl!)}
            accessibilityRole="imagebutton"
            accessibilityLabel="Open photo full screen"
          >
            <Image source={{ uri: record.imageUrl }} style={styles.detailImage} contentFit="cover" />
            <View style={styles.expandBadge}>
              <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
              <Text style={styles.expandText}>Tap to enlarge</Text>
            </View>
          </Pressable>
        ) : (
          <Text style={styles.noPhoto}>No photo attached</Text>
        )}
      </View>

      <AuditLine text={auditText(record)} />

      {record.canManage && (
        <View style={styles.actionRow}>
          <PrimaryButton title="Delete" variant="ghost" onPress={onDelete} loading={deleting} style={styles.flex1} />
          <PrimaryButton title="Edit" onPress={onEdit} style={styles.flex1} />
        </View>
      )}
    </View>
  );
}

function RecordForm({
  record,
  saving,
  onSave,
  onCancel,
}: {
  record: AgeRestrictionRecord | null;
  saving: boolean;
  onSave: (input: AgeRestrictionInput) => void;
  onCancel: () => void;
}) {
  const [when, setWhen] = useState<Date>(() => (record ? new Date(record.occurredAt) : new Date()));
  const [description, setDescription] = useState(record?.description ?? '');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [inFuture, setInFuture] = useState(false);
  // Stable across renders so the native picker isn't re-bounded (and reset) on every change.
  const [maxDate] = useState(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end;
  });

  const previewUri = imageUri ?? (removeImage ? null : record?.imageUrl ?? null);

  const applyWhen = (next: Date) => {
    setWhen(next);
    setInFuture(next.getTime() > Date.now() + 60_000);
  };
  const setDate = (date: Date) => {
    const next = new Date(when);
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    applyWhen(next);
  };
  const setTime = (time: Date) => {
    const next = new Date(when);
    next.setHours(time.getHours(), time.getMinutes(), 0, 0);
    applyWhen(next);
  };

  const handlePickerResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (uri) {
      setImageUri(uri);
      setRemoveImage(false);
    } else {
      Alert.alert('No photo', 'That image could not be used. Please try another.');
    }
  };

  const choosePhoto = async () => {
    try {
      handlePickerResult(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 }));
    } catch {
      Alert.alert('Gallery unavailable', 'Could not open your photo library.');
    }
  };

  const takePhoto = async () => {
    let permission = await ImagePicker.getCameraPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await ImagePicker.requestCameraPermissionsAsync();
    }
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings, or choose a photo from your gallery.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    try {
      handlePickerResult(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 }));
    } catch {
      Alert.alert('Camera unavailable', 'Could not open the camera on this device.');
    }
  };

  const clearPhoto = () => {
    setImageUri(null);
    setRemoveImage(!!record?.imageUrl);
  };

  const trimmed = description.trim();
  const valid = trimmed.length > 0 && !inFuture;

  return (
    <View style={styles.sheetContent}>
      <Text style={styles.sheetTitle}>{record ? 'Edit Record' : 'New Age Restriction Record'}</Text>
      {/* Full width: a half-width iOS date spinner clips the day and year wheels. */}
      <DateTimeField label="Date" mode="date" value={when} onChange={setDate} maximumDate={maxDate} />
      <DateTimeField label="Time" mode="time" value={when} onChange={setTime} />
      {inFuture && <Text style={styles.errorText}>Date and time can&apos;t be in the future.</Text>}

      <View>
        <TextField
          label="Short description"
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Refused alcohol sale — customer had no ID"
          maxLength={AGE_RESTRICTION_DESCRIPTION_MAX}
          multiline
        />
        <Text style={styles.counter}>
          {description.length}/{AGE_RESTRICTION_DESCRIPTION_MAX}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.infoLabel}>Photo (optional)</Text>
        {previewUri ? (
          <View>
            <Image source={{ uri: previewUri }} style={styles.detailImage} contentFit="cover" />
            <Pressable
              onPress={clearPhoto}
              hitSlop={8}
              style={styles.removePhoto}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.photoButtons}>
          <Pressable onPress={takePhoto} style={styles.photoButton}>
            <Ionicons name="camera-outline" size={20} color={Colors.light.primary} />
            <Text style={styles.photoButtonText}>{previewUri ? 'Retake' : 'Take Photo'}</Text>
          </Pressable>
          <Pressable onPress={choosePhoto} style={styles.photoButton}>
            <Ionicons name="images-outline" size={20} color={Colors.light.primary} />
            <Text style={styles.photoButtonText}>{previewUri ? 'Replace' : 'Choose Photo'}</Text>
          </Pressable>
        </View>
      </View>

      <PrimaryButton
        title={record ? 'Save Changes' : 'Save Record'}
        onPress={() => valid && onSave({ occurredAt: when, description: trimmed, imageUri, removeImage })}
        disabled={!valid}
        loading={saving}
      />
      <PrimaryButton title="Cancel" variant="ghost" onPress={onCancel} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  countText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  whenText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginRight: Spacing.sm,
  },
  description: {
    ...Typography.body,
    color: Colors.light.text,
    lineHeight: 20,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundSecondary,
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
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  infoTile: {
    flex: 1,
    gap: 6,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundCard,
  },
  infoLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoValue: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  section: {
    gap: Spacing.sm,
  },
  detailDescription: {
    ...Typography.body,
    color: Colors.light.text,
    lineHeight: 22,
  },
  detailImage: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  expandBadge: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  expandText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  noPhoto: {
    ...Typography.bodySmall,
    color: Colors.light.textLight,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.light.error,
    marginTop: -Spacing.sm,
  },
  counter: {
    ...Typography.caption,
    color: Colors.light.textLight,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  removePhoto: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    minHeight: 52,
  },
  photoButtonText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.primary,
  },
});
