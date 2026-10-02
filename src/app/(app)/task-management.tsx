import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { useEmployees } from '@/features/employees/hooks';
import { DateTimeField } from '@/features/shop-tools/components/date-time-field';
import { EmptyState } from '@/features/shop-tools/components/empty-state';
import { AuditLine, Fab, RecordCard, StatusPill } from '@/features/shop-tools/components/primitives';
import { SegmentedTabs } from '@/features/shop-tools/components/segmented-tabs';
import { ListSkeleton } from '@/features/shop-tools/components/stat-card';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { useIsOwner } from '@/features/shop-tools/hooks/use-is-owner';
import { formatDate } from '@/features/shop-tools/format';
import {
  completeTask,
  createTask,
  deleteTask,
  fetchMyTasks,
  fetchTasks,
  startTask,
  taskKeys,
  updateTask,
  type MyTask,
  type ShopTask,
  type TaskInput,
  type TaskStatus,
} from '@/features/tasks/api';
import {
  CELEBRATION_MS,
  TaskActionButton,
  TaskProgress,
  type TaskActionState,
} from '@/features/tasks/components/complete-button';

const completeSound = require('@/assets/sounds/task-complete.wav');

type StatusTab = 'all' | TaskStatus;

const statusMeta: Record<TaskStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: Colors.light.warning },
  IN_PROGRESS: { label: 'In progress', color: Colors.light.primary },
  COMPLETED: { label: 'Completed', color: Colors.light.success },
};

/** Task management: owners create & assign; employees work their own list. */
export default function TaskManagementScreen() {
  const isOwner = useIsOwner();
  return isOwner ? <OwnerTasks /> : <EmployeeTasks />;
}

// ---------- Owner view ----------

function OwnerTasks() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<StatusTab>('all');
  const [editing, setEditing] = useState<ShopTask | null>(null);
  const [showForm, setShowForm] = useState(false);

  const tasks = useQuery({ queryKey: taskKeys.all, queryFn: fetchTasks, staleTime: 30_000 });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });
  const create = useMutation({ mutationFn: createTask, onSettled: invalidate });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TaskInput> }) => updateTask(id, input),
    onSettled: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteTask, onSettled: invalidate });

  const counts = useMemo(() => {
    const all = tasks.data ?? [];
    return {
      all: all.length,
      PENDING: all.filter((t) => t.status === 'PENDING').length,
      IN_PROGRESS: all.filter((t) => t.status === 'IN_PROGRESS').length,
      COMPLETED: all.filter((t) => t.status === 'COMPLETED').length,
    };
  }, [tasks.data]);

  const visible = useMemo(
    () => (tasks.data ?? []).filter((t) => tab === 'all' || t.status === tab),
    [tasks.data, tab],
  );

  const handleDelete = (task: ShopTask) => {
    Alert.alert('Delete task', `Delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(task.id, {
            onSuccess: () => showToast('Task deleted', 'success'),
            onError: (error: any) => showToast(error?.message ?? 'Could not delete', 'error'),
          }),
      },
    ]);
  };

  return (
    <ToolScreen title="Task Management" subtitle="Assign & track shop tasks">
      <SegmentedTabs<StatusTab>
        options={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'PENDING', label: 'Pending', count: counts.PENDING },
          { value: 'IN_PROGRESS', label: 'In progress', count: counts.IN_PROGRESS },
          { value: 'COMPLETED', label: 'Done', count: counts.COMPLETED },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tasks.isLoading ? (
        <ListSkeleton rows={5} height={96} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={tasks.isRefetching}
              onRefresh={tasks.refetch}
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
              <View style={styles.taskHead}>
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <StatusPill label={statusMeta[item.status].label} color={statusMeta[item.status].color} />
              </View>
              {!!item.description && (
                <Text style={styles.taskDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <View style={styles.assigneeRow}>
                {item.assignments.map((a) => (
                  <View
                    key={a.id}
                    style={[styles.assigneeChip, a.isCompleted && styles.assigneeChipDone]}
                  >
                    {a.isCompleted && (
                      <Ionicons name="checkmark" size={12} color={Colors.light.success} />
                    )}
                    <Text style={[styles.assigneeText, a.isCompleted && styles.assigneeTextDone]}>
                      {a.employee.name}
                    </Text>
                  </View>
                ))}
              </View>
              <AuditLine
                text={`${item.completedCount}/${item.totalAssignments} done${
                  item.dueDate ? ` · Due ${formatDate(item.dueDate)}` : ''
                }`}
              />
            </RecordCard>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="checkbox-outline"
              title="No tasks"
              subtitle="Create tasks and assign them to your team."
            />
          }
        />
      )}

      <Fab
        label="New Task"
        onPress={() => {
          setEditing(null);
          setShowForm(true);
        }}
      />

      <TaskForm
        visible={showForm}
        task={editing}
        onClose={() => setShowForm(false)}
        saving={create.isPending || update.isPending}
        onSave={(input) => {
          const mutation = editing
            ? update.mutateAsync({ id: editing.id, input })
            : create.mutateAsync(input);
          mutation
            .then(() => {
              setShowForm(false);
              showToast(editing ? 'Task updated' : 'Task assigned', 'success');
            })
            .catch((error: any) => showToast(error?.message ?? 'Could not save', 'error'));
        }}
      />
    </ToolScreen>
  );
}

function TaskForm({
  visible,
  task,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  task: ShopTask | null;
  onClose: () => void;
  onSave: (input: TaskInput) => void;
  saving: boolean;
}) {
  const employees = useEmployees(visible);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = visible ? (task?.id ?? 'new') : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setTitle(task?.title ?? '');
      setDescription(task?.description ?? '');
      setDueDate(task?.dueDate ? new Date(task.dueDate) : null);
      setSelectedIds(task ? task.assignments.map((a) => a.employee.id) : []);
    }
  }

  const toggleEmployee = (id: number) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const valid = title.trim().length > 0 && selectedIds.length > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware scrollable>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>{task ? 'Edit Task' : 'New Task'}</Text>
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Restock shelves" />
        <TextField
          label="Details (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What needs doing?"
          multiline
        />
        <DateTimeField
          label="Due date (optional)"
          mode="date"
          value={dueDate}
          onChange={setDueDate}
          placeholder="No due date"
          minimumDate={new Date()}
        />
        <View>
          <Text style={styles.fieldLabel}>Assign to</Text>
          {(employees.data ?? []).length === 0 ? (
            <Text style={styles.emptyNote}>
              {employees.isLoading ? 'Loading team…' : 'No employees yet — add your team first.'}
            </Text>
          ) : (
            <View style={styles.employeeWrap}>
              {(employees.data ?? []).map((emp) => {
                const active = selectedIds.includes(emp.id);
                return (
                  <Pressable
                    key={emp.id}
                    onPress={() => toggleEmployee(emp.id)}
                    style={[styles.empChip, active && styles.empChipActive]}
                  >
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={15}
                      color={active ? '#FFF' : Colors.light.textLight}
                    />
                    <Text style={[styles.empChipText, active && styles.empChipTextActive]}>
                      {emp.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
        <PrimaryButton
          title={task ? 'Save Changes' : 'Assign Task'}
          loading={saving}
          disabled={!valid}
          onPress={() =>
            valid &&
            onSave({
              title: title.trim(),
              description: description.trim() || undefined,
              dueDate: dueDate ? dueDate.toISOString() : null,
              employeeIds: selectedIds,
            })
          }
        />
      </View>
    </BottomSheet>
  );
}

// ---------- Employee view ----------

function EmployeeTasks() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'todo' | 'done'>('todo');
  const [overrides, setOverrides] = useState<Record<string, TaskActionState>>({});
  const inFlight = useRef(new Set<string>());
  const chime = useAudioPlayer(completeSound);

  const tasks = useQuery({ queryKey: taskKeys.mine, queryFn: fetchMyTasks, staleTime: 30_000 });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });

  const all = tasks.data ?? [];
  const todo = all.filter((t) => !t.isCompleted);
  const done = all.filter((t) => t.isCompleted);
  const visible = tab === 'todo' ? todo : done;

  const setOverride = (id: string, state?: TaskActionState) =>
    setOverrides((prev) => {
      if (state) return { ...prev, [id]: state };
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });

  const handleStart = async (task: MyTask) => {
    const id = task.assignmentId;
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOverride(id, 'starting');
    try {
      await startTask(id);
      // Reflect "In progress" only after the backend confirmed.
      queryClient.setQueryData<MyTask[]>(taskKeys.mine, (prev) =>
        prev?.map((t) =>
          t.assignmentId === id
            ? { ...t, isStarted: true, startedAt: t.startedAt ?? new Date().toISOString() }
            : t,
        ),
      );
      setOverride(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      showToast('Task started — good luck!', 'success');
      invalidate();
    } catch (error: any) {
      setOverride(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showToast(error?.message ?? 'Could not start the task — try again', 'error');
    } finally {
      inFlight.current.delete(id);
    }
  };

  const handleComplete = async (task: MyTask) => {
    const id = task.assignmentId;
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOverride(id, 'completing');

    try {
      const result = await completeTask(id);
      // Celebrate only once the backend has confirmed.
      setOverride(id, 'celebrating');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      try {
        chime.seekTo(0);
        chime.play();
      } catch {
        // sound is best-effort
      }
      const remaining = todo.filter((t) => t.assignmentId !== id).length;
      showToast(
        result.alreadyCompleted
          ? 'Already marked as done'
          : remaining === 0
            ? 'All tasks complete — brilliant work!'
            : `Task complete! ${remaining} to go`,
        'success',
      );

      // Let the celebration play, then move the card into Completed.
      setTimeout(() => {
        queryClient.setQueryData<MyTask[]>(taskKeys.mine, (prev) =>
          prev?.map((t) =>
            t.assignmentId === id
              ? {
                  ...t,
                  isCompleted: true,
                  isStarted: true,
                  completedAt: result.completedAt ?? new Date().toISOString(),
                }
              : t,
          ),
        );
        setOverride(id);
        inFlight.current.delete(id);
        invalidate();
      }, CELEBRATION_MS);
    } catch (error: any) {
      inFlight.current.delete(id);
      setOverride(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showToast(error?.message ?? 'Could not complete the task — try again', 'error');
    }
  };

  return (
    <ToolScreen title="My Tasks" subtitle="Assigned to you">
      <SegmentedTabs<'todo' | 'done'>
        options={[
          { value: 'todo', label: 'To do', count: todo.length },
          { value: 'done', label: 'Completed', count: done.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tasks.isLoading ? (
        <ListSkeleton rows={5} height={96} />
      ) : (
        <Animated.FlatList
          data={visible}
          keyExtractor={(item) => item.assignmentId}
          contentContainerStyle={styles.listContent}
          itemLayoutAnimation={LinearTransition.springify().damping(18)}
          ListHeaderComponent={
            tab === 'todo' ? <TaskProgress done={done.length} total={all.length} /> : null
          }
          refreshControl={
            <RefreshControl
              refreshing={tasks.isRefetching}
              onRefresh={tasks.refetch}
              tintColor={Colors.light.primary}
            />
          }
          renderItem={({ item }) => {
            const state: TaskActionState =
              overrides[item.assignmentId] ??
              (item.isCompleted ? 'done' : item.isStarted ? 'in_progress' : 'not_started');
            const celebrating = state === 'celebrating';
            return (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(220)}>
                <RecordCard style={celebrating ? styles.cardCelebrating : undefined}>
                  <View style={styles.taskHead}>
                    <Text
                      style={[styles.taskTitle, item.isCompleted && styles.taskTitleDone]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <StatusPill
                      label={
                        item.isCompleted || celebrating
                          ? 'Done'
                          : item.isStarted
                            ? 'In progress'
                            : 'Pending'
                      }
                      color={
                        item.isCompleted || celebrating
                          ? Colors.light.success
                          : item.isStarted
                            ? Colors.light.primary
                            : Colors.light.warning
                      }
                    />
                  </View>
                  {!!item.description && <Text style={styles.taskDesc}>{item.description}</Text>}
                  <AuditLine
                    text={
                      item.isCompleted && item.completedAt
                        ? `From ${item.createdBy?.name ?? 'Owner'} · Completed ${formatDate(item.completedAt)}`
                        : `From ${item.createdBy?.name ?? 'Owner'}${
                            item.dueDate ? ` · Due ${formatDate(item.dueDate)}` : ''
                          }`
                    }
                  />
                  {!item.isCompleted && (
                    <View style={styles.actionRow}>
                      <TaskActionButton
                        state={state}
                        onStart={() => handleStart(item)}
                        onComplete={() => handleComplete(item)}
                      />
                    </View>
                  )}
                </RecordCard>
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="checkbox-outline"
              title={tab === 'todo' ? 'Nothing to do' : 'No completed tasks yet'}
              subtitle={tab === 'todo' ? "You're all caught up." : undefined}
            />
          }
        />
      )}
    </ToolScreen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  taskHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  taskTitle: {
    ...Typography.bodyBold,
    color: Colors.light.text,
    flex: 1,
  },
  taskTitleDone: {
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
  cardCelebrating: {
    borderColor: Colors.light.success,
    backgroundColor: '#F3FAF3',
  },
  taskDesc: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  assigneeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  assigneeChipDone: {
    backgroundColor: '#E5F1E6',
  },
  assigneeText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  assigneeTextDone: {
    color: Colors.light.success,
    fontWeight: '600',
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
  fieldLabel: {
    ...Typography.label,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
  },
  emptyNote: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  employeeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  empChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundCard,
  },
  empChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  empChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  empChipTextActive: {
    color: '#FFF',
  },
  actionRow: {
    marginTop: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
  },
});
