import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ImageViewer } from '@/components/ui/image-viewer';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import {
  createIncident,
  deleteIncident,
  fetchIncidents,
  incidentKeys,
  updateIncident,
  type IncidentInput,
  type IncidentLog,
  type IncidentSeverity,
} from '@/features/incidents/api';
import { exportIncidentsPdf } from '@/features/incidents/export-pdf';
import { DateTimeField } from '@/features/shop-tools/components/date-time-field';
import { EmptyState } from '@/features/shop-tools/components/empty-state';
import { AuditLine, Fab, RecordCard, StatusPill } from '@/features/shop-tools/components/primitives';
import { OptionPicker } from '@/features/shop-tools/components/option-picker';
import { SegmentedTabs } from '@/features/shop-tools/components/segmented-tabs';
import { ListSkeleton } from '@/features/shop-tools/components/stat-card';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { useIsOwner } from '@/features/shop-tools/hooks/use-is-owner';
import { formatDateTime, toDateParam, toTimeParam } from '@/features/shop-tools/format';

type Range = 'today' | 'week' | 'month' | 'all';

const severityColor: Record<IncidentSeverity, string> = {
  LOW: Colors.light.success,
  MEDIUM: Colors.light.warning,
  HIGH: Colors.light.error,
};

const rangeLabels: Record<Range, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
};

/** Incident log: anyone can report; only the owner can edit or delete. */
export default function IncidentLogsScreen() {
  const isOwner = useIsOwner();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<Range>('all');
  const [severity, setSeverity] = useState<IncidentSeverity | null>(null);
  const [editing, setEditing] = useState<IncidentLog | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const dates = useMemo(() => {
    const now = new Date();
    if (range === 'today') return { startDate: toDateParam(now), endDate: toDateParam(now) };
    if (range === 'week') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { startDate: toDateParam(start), endDate: undefined };
    }
    if (range === 'month') {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { startDate: toDateParam(start), endDate: undefined };
    }
    return { startDate: undefined, endDate: undefined };
  }, [range]);

  const filters = { ...dates, severity: severity ?? undefined };
  const incidents = useQuery({
    queryKey: incidentKeys.list(filters),
    queryFn: () => fetchIncidents({ ...filters, limit: 200 }),
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['incidents'] });
  const create = useMutation({ mutationFn: createIncident, onSettled: invalidate });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: IncidentInput }) => updateIncident(id, input),
    onSettled: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteIncident, onSettled: invalidate });

  const handleDelete = (log: IncidentLog) => {
    Alert.alert('Delete incident', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(log.id, {
            onSuccess: () => showToast('Incident deleted', 'success'),
            onError: (error: any) => showToast(error?.message ?? 'Could not delete', 'error'),
          }),
      },
    ]);
  };

  const handleExport = async () => {
    const logs = incidents.data ?? [];
    if (!logs.length) {
      showToast('Nothing to export in this period', 'info');
      return;
    }
    setExporting(true);
    try {
      await exportIncidentsPdf(logs, rangeLabels[range]);
    } catch {
      showToast('Could not create the PDF', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ToolScreen
      title="Incident Logs"
      subtitle="Accidents & issues"
      rightIcon={exporting ? undefined : 'download-outline'}
      onRightPress={handleExport}
    >
      <SegmentedTabs<Range>
        options={[
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'This Week' },
          { value: 'month', label: 'This Month' },
          { value: 'all', label: 'All' },
        ]}
        value={range}
        onChange={setRange}
      />
      <View style={styles.severityRow}>
        {(['LOW', 'MEDIUM', 'HIGH'] as IncidentSeverity[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSeverity(severity === s ? null : s)}
            style={[
              styles.severityChip,
              severity === s && { backgroundColor: severityColor[s], borderColor: severityColor[s] },
            ]}
          >
            <Text style={[styles.severityChipText, severity === s && { color: '#FFF' }]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {incidents.isLoading ? (
        <ListSkeleton rows={5} height={96} />
      ) : (
        <FlatList
          data={incidents.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={incidents.isRefetching}
              onRefresh={incidents.refetch}
              tintColor={Colors.light.primary}
            />
          }
          renderItem={({ item }) => (
            <RecordCard
              onPress={
                isOwner
                  ? () => {
                      setEditing(item);
                      setShowForm(true);
                    }
                  : undefined
              }
              onLongPress={isOwner ? () => handleDelete(item) : undefined}
            >
              <View style={styles.incidentRow}>
                <View style={styles.incidentBody}>
                  <View style={styles.incidentHead}>
                    <StatusPill label={item.severity} color={severityColor[item.severity]} />
                    <Text style={styles.incidentDate}>{formatDateTime(item.incidentAt)}</Text>
                  </View>
                  <Text style={styles.incidentDesc}>{item.description}</Text>
                  <AuditLine
                    text={`Reported by ${item.createdByName}${
                      item.updatedByName ? ` · Updated by ${item.updatedByName}` : ''
                    }`}
                  />
                </View>
                {!!item.imageUrl && (
                  <Pressable onPress={() => setViewerUri(item.imageUrl!)}>
                    <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="cover" />
                  </Pressable>
                )}
              </View>
            </RecordCard>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="warning-outline"
              title="No incidents"
              subtitle="Log accidents, damage or safety issues so there's always a record."
            />
          }
        />
      )}

      <Fab
        label="Report Incident"
        onPress={() => {
          setEditing(null);
          setShowForm(true);
        }}
      />

      <IncidentForm
        visible={showForm}
        incident={editing}
        onClose={() => setShowForm(false)}
        saving={create.isPending || update.isPending}
        onSave={(input) => {
          const mutation = editing
            ? update.mutateAsync({ id: editing.id, input })
            : create.mutateAsync(input);
          mutation
            .then(() => {
              setShowForm(false);
              showToast(editing ? 'Incident updated' : 'Incident reported', 'success');
            })
            .catch((error: any) => showToast(error?.message ?? 'Could not save', 'error'));
        }}
      />

      {viewerUri && (
        <ImageViewer uri={viewerUri} visible={viewerUri != null} onClose={() => setViewerUri(null)} />
      )}
    </ToolScreen>
  );
}

function IncidentForm({
  visible,
  incident,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  incident: IncidentLog | null;
  onClose: () => void;
  onSave: (input: IncidentInput) => void;
  saving: boolean;
}) {
  const [when, setWhen] = useState<Date>(new Date());
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = visible ? (incident?.id ?? 'new') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setWhen(incident ? new Date(incident.incidentAt) : new Date());
      setDescription(incident?.description ?? '');
      setSeverity(incident?.severity ?? 'MEDIUM');
      setImageUri(null);
    }
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const valid = description.trim().length > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware scrollable>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>{incident ? 'Edit Incident' : 'Report Incident'}</Text>
        <View style={styles.dateTimeRow}>
          <View style={styles.flex1}>
            <DateTimeField label="Date" mode="date" value={when} onChange={setWhen} maximumDate={new Date()} />
          </View>
          <View style={styles.flex1}>
            <DateTimeField label="Time" mode="time" value={when} onChange={setWhen} />
          </View>
        </View>
        <TextField
          label="What happened?"
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the incident..."
          multiline
        />
        <OptionPicker<IncidentSeverity>
          label="Severity"
          options={[
            { value: 'LOW', label: 'Low', color: severityColor.LOW },
            { value: 'MEDIUM', label: 'Medium', color: severityColor.MEDIUM },
            { value: 'HIGH', label: 'High', color: severityColor.HIGH },
          ]}
          value={severity}
          onChange={setSeverity}
        />
        <Pressable onPress={pickImage} style={styles.imagePicker}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={20} color={Colors.light.primary} />
              <Text style={styles.imagePickerText}>
                {incident?.imageUrl ? 'Replace photo (optional)' : 'Attach photo (optional)'}
              </Text>
            </>
          )}
        </Pressable>
        <PrimaryButton
          title={incident ? 'Save Changes' : 'Submit Report'}
          onPress={() =>
            valid &&
            onSave({
              date: toDateParam(when),
              time: toTimeParam(when),
              description: description.trim(),
              severity,
              imageUri,
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
  severityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  severityChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundCard,
  },
  severityChipText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  incidentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  incidentBody: {
    flex: 1,
    gap: 6,
  },
  incidentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  incidentDate: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  incidentDesc: {
    ...Typography.body,
    color: Colors.light.text,
    lineHeight: 20,
  },
  thumb: {
    width: 64,
    height: 64,
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
  imagePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    minHeight: 56,
  },
  imagePickerText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  imagePreview: {
    width: '100%',
    height: 140,
    borderRadius: BorderRadius.md,
  },
});
