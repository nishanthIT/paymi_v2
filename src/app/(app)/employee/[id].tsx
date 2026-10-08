import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import type { EmployeeListSummary } from '@/features/employees/api';
import { monogram } from '@/features/employees/format';
import {
  useCanManageShopEmployees,
  useEmployeeLists,
  useEmployeeTasks,
  useEmployees,
} from '@/features/employees/hooks';
import { SHOP_FEATURE_OPTIONS } from '@/features/employees/permissions';
import { useTrackList } from '@/features/lists/hooks/use-lists';
import { SegmentedTabs } from '@/features/shop-tools/components/segmented-tabs';
import type { ShopTask } from '@/features/tasks/api';
import { useRefetchOnFocus } from '@/hooks/use-query-refresh';

type Tab = 'lists' | 'tasks';

/** One shop employee: their lists (open, copy to my lists) and the tasks assigned to them. */
export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const employeeId = Number(id);
  const router = useRouter();
  const { showToast } = useToast();
  const canManage = useCanManageShopEmployees();

  const employee = useEmployees(canManage).data?.find((e) => e.id === employeeId);
  const listsQuery = useEmployeeLists(employeeId);
  const tasksQuery = useEmployeeTasks(employeeId);
  const trackList = useTrackList();
  useRefetchOnFocus(listsQuery.refetch);

  const [tab, setTab] = useState<Tab>('lists');
  const lists = useMemo(() => listsQuery.data ?? [], [listsQuery.data]);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const toolCount = SHOP_FEATURE_OPTIONS.filter((o) => employee?.permissions?.includes(o.value)).length;

  const copyList = (list: EmployeeListSummary) =>
    trackList.mutate(list.id, {
      onSuccess: () => showToast(`“${list.name}” is now in your lists`, 'success'),
      onError: (error: any) => {
        if (!error?.silent) showToast(error?.message ?? 'Could not copy this list', 'error');
      },
    });

  const refreshing = listsQuery.isRefetching || tasksQuery.isRefetching;
  const onRefresh = () => {
    listsQuery.refetch();
    tasksQuery.refetch();
  };

  const header = (
    <View>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{monogram(employee?.name ?? '?')}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {employee?.name ?? 'Shop employee'}
          </Text>
          {!!employee?.email && (
            <Text style={styles.email} numberOfLines={1}>
              {employee.email}
            </Text>
          )}
          {employee && (
            <Text style={styles.meta}>
              {employee.status === 'ACTIVE' ? 'Active' : employee.status === 'INVITED' ? 'Invited' : 'Inactive'} ·{' '}
              {toolCount}/{SHOP_FEATURE_OPTIONS.length} tools
            </Text>
          )}
        </View>
      </View>
      <SegmentedTabs<Tab>
        options={[
          { value: 'lists', label: 'Lists', count: lists.length },
          { value: 'tasks', label: 'Tasks', count: tasks.length },
        ]}
        value={tab}
        onChange={setTab}
      />
    </View>
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {employee?.name ?? 'Employee'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {tab === 'lists' ? (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          refreshControl={refreshControl}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <EmployeeListRow
              list={item}
              copying={trackList.isPending && trackList.variables === item.id}
              onOpen={() => router.push(`/employee/list/${item.id}` as Href)}
              onCopy={() => copyList(item)}
            />
          )}
          ListEmptyComponent={
            listsQuery.isPending ? null : listsQuery.isError ? (
              <EmptyState icon="alert-circle-outline" title="Couldn’t load lists" body={listsQuery.error.message} />
            ) : (
              <EmptyState
                icon="list-outline"
                title="No lists yet"
                body="Lists this employee creates in your shop appear here instantly."
              />
            )
          }
        />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          refreshControl={refreshControl}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <EmployeeTaskRow task={item} employeeId={employeeId} />}
          ListEmptyComponent={
            tasksQuery.isPending ? null : tasksQuery.isError ? (
              <EmptyState icon="alert-circle-outline" title="Couldn’t load tasks" body={tasksQuery.error.message} />
            ) : (
              <EmptyState
                icon="checkbox-outline"
                title="No tasks assigned"
                body="Assign tasks from Profile → Tasks and they show up here."
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

function EmployeeListRow({
  list,
  copying,
  onOpen,
  onCopy,
}: {
  list: EmployeeListSummary;
  copying: boolean;
  onOpen: () => void;
  onCopy: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.listIcon}>
        <Ionicons name="list" size={18} color={Colors.light.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {list.name}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
          {list.collectedCount > 0 ? ` · ${list.collectedCount} collected` : ''} ·{' '}
          {new Date(list.createdAt).toLocaleDateString()}
        </Text>
      </View>
      {list.copiedByMe ? (
        <View style={styles.inMyLists}>
          <Ionicons name="sync-outline" size={12} color={Colors.light.success} />
          <Text style={styles.inMyListsText}>In my lists</Text>
        </View>
      ) : (
        <Pressable
          onPress={onCopy}
          disabled={copying}
          hitSlop={8}
          style={({ pressed }) => [styles.copyButton, (pressed || copying) && { opacity: 0.6 }]}
        >
          <Ionicons name="copy-outline" size={14} color={Colors.light.primary} />
          <Text style={styles.copyButtonText}>{copying ? 'Copying…' : 'Copy'}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function EmployeeTaskRow({ task, employeeId }: { task: ShopTask; employeeId: number }) {
  const assignment = task.assignments.find((a) => a.employee?.id === employeeId);
  const state = assignment?.isCompleted ? 'Done' : assignment?.isStarted ? 'In progress' : 'Not started';
  const color =
    state === 'Done' ? Colors.light.success : state === 'In progress' ? Colors.light.warning : Colors.light.textLight;
  return (
    <View style={styles.card}>
      <View style={styles.listIcon}>
        <Ionicons
          name={assignment?.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
          size={18}
          color={assignment?.isCompleted ? Colors.light.success : Colors.light.primary}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {task.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}
          {task.totalAssignments > 1 ? ` · ${task.completedCount}/${task.totalAssignments} done overall` : ''}
        </Text>
      </View>
      <Text style={[styles.taskState, { color }]}>{state}</Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={Colors.light.textLight} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  title: {
    ...Typography.h4,
    color: Colors.light.text,
    flexShrink: 1,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.h4,
    color: Colors.light.primary,
  },
  name: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  email: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  meta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.light.text,
  },
  cardMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  inMyLists: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inMyListsText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.success,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
  },
  copyButtonText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  taskState: {
    ...Typography.caption,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  emptyBody: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
