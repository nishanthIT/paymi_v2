import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import type { Employee, EmployeeInput } from '@/features/employees/api';
import { EmployeeFormSheet } from '@/features/employees/components/employee-form-sheet';
import {
  useCreateEmployee,
  useDeleteEmployee,
  useEmployees,
  useUpdateEmployee,
} from '@/features/employees/hooks';
import { useTrackList } from '@/features/lists/hooks/use-lists';

function monogram(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Manage Employees (shop owners only). Employees get access to Home,
 * Lists and Chat under this shop, but never to admin features.
 */
export default function EmployeesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const isOwner = user?.userType === 'CUSTOMER';
  const employeesQuery = useEmployees(isOwner);
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const trackList = useTrackList();

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewingLists, setViewingLists] = useState<Employee | null>(null);

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const totalLists = employees.reduce((sum, e) => sum + (e.listCount ?? 0), 0);

  const handleSubmit = useCallback(
    async (input: EmployeeInput) => {
      try {
        if (editing) {
          await updateMutation.mutateAsync({ id: editing.id, input });
          showToast('Employee updated', 'success');
        } else {
          await createMutation.mutateAsync(input);
          showToast('Employee added', 'success');
        }
        setFormVisible(false);
        setEditing(null);
      } catch (error: any) {
        if (!error?.silent) showToast(error?.message ?? 'Something went wrong', 'error');
      }
    },
    [editing, createMutation, updateMutation, showToast],
  );

  const handleDelete = useCallback(
    (employee: Employee) => {
      Alert.alert(
        'Delete employee?',
        `${employee.name} will lose access immediately. Their lists stay with the shop.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              deleteMutation.mutate(employee.id, {
                onSuccess: () => showToast('Employee removed', 'success'),
                onError: (error: any) => {
                  if (!error?.silent) showToast(error?.message ?? 'Delete failed', 'error');
                },
              }),
          },
        ],
      );
    },
    [deleteMutation, showToast],
  );

  const handleAddToMyLists = useCallback(
    (listId: string) => {
      trackList.mutate(listId, {
        onSuccess: () => showToast('Added to your lists', 'success'),
        onError: (error: any) => {
          if (!error?.silent) showToast(error?.message ?? 'Could not add list', 'error');
        },
      });
    },
    [trackList, showToast],
  );

  if (!isOwner) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.centerState}>
          <Ionicons name="lock-closed-outline" size={40} color={Colors.light.textLight} />
          <Text style={styles.centerTitle}>Admins only</Text>
          <Text style={styles.centerBody}>
            Employee management is available to the shop owner account.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        onBack={() => router.back()}
        onAdd={() => {
          setEditing(null);
          setFormVisible(true);
        }}
      />

      <Animated.View entering={FadeInUp.duration(350)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{employees.length}</Text>
          <Text style={styles.statLabel}>Employees</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalLists}</Text>
          <Text style={styles.statLabel}>Lists created</Text>
        </View>
      </Animated.View>

      <FlatList
        data={employees}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={employeesQuery.isRefetching}
            onRefresh={() => employeesQuery.refetch()}
            tintColor={Colors.light.primary}
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.duration(250).delay(index * 40)}
            layout={LinearTransition.springify().damping(26)}
          >
            <EmployeeCard
              employee={item}
              onViewLists={() => setViewingLists(item)}
              onEdit={() => {
                setEditing(item);
                setFormVisible(true);
              }}
              onDelete={() => handleDelete(item)}
            />
          </Animated.View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          employeesQuery.isPending ? null : (
            <View style={styles.centerState}>
              <Ionicons name="people-outline" size={40} color={Colors.light.textLight} />
              <Text style={styles.centerTitle}>No employees yet</Text>
              <Text style={styles.centerBody}>
                Add your first team member — they can build lists and chat with the team.
              </Text>
            </View>
          )
        }
      />

      <EmployeeFormSheet
        visible={formVisible}
        employee={editing}
        onClose={() => {
          setFormVisible(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      />

      <BottomSheet visible={!!viewingLists} onClose={() => setViewingLists(null)}>
        <ScrollView bounces={false} style={styles.listsSheet}>
          <Text style={styles.sheetTitle}>{viewingLists?.name}&apos;s lists</Text>
          {(viewingLists?.lists?.length ?? 0) === 0 ? (
            <Text style={styles.centerBody}>No lists created yet.</Text>
          ) : (
            viewingLists?.lists.map((list) => (
              <View key={list.id} style={styles.listRow}>
                <View style={styles.listIcon}>
                  <Ionicons name="list" size={18} color={Colors.light.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.listName}>{list.name}</Text>
                  <Text style={styles.listMeta}>
                    {list.productCount} {list.productCount === 1 ? 'item' : 'items'} ·{' '}
                    {new Date(list.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleAddToMyLists(list.id)}
                  disabled={trackList.isPending}
                  hitSlop={8}
                  style={({ pressed }) => [styles.addListButton, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="add" size={16} color={Colors.light.primary} />
                  <Text style={styles.addListButtonText}>Add to my lists</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Header({ onBack, onAdd }: { onBack: () => void; onAdd?: () => void }) {
  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
      >
        <Ionicons name="chevron-back" size={22} color={Colors.light.text} />
      </Pressable>
      <Text style={styles.title}>Manage Employees</Text>
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          hitSlop={10}
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </Pressable>
      ) : (
        <View style={{ width: 38 }} />
      )}
    </View>
  );
}

function EmployeeCard({
  employee,
  onViewLists,
  onEdit,
  onDelete,
}: {
  employee: Employee;
  onViewLists: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{monogram(employee.name)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.cardName}>{employee.name}</Text>
          <Text style={styles.cardEmail} numberOfLines={1}>
            {employee.email}
          </Text>
        </View>
        <View style={styles.listCountPill}>
          <Ionicons name="list" size={12} color={Colors.light.primary} />
          <Text style={styles.listCountText}>{employee.listCount}</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <CardAction icon="eye-outline" label="View Lists" onPress={onViewLists} />
        <CardAction icon="create-outline" label="Edit" onPress={onEdit} />
        <CardAction icon="trash-outline" label="Delete" destructive onPress={onDelete} />
      </View>
    </View>
  );
}

function CardAction({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const color = destructive ? Colors.light.error : Colors.light.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
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
  addButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  title: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 2,
    ...Shadows.sm,
  },
  statValue: {
    ...Typography.h2,
    color: Colors.light.primary,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
  cardName: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  cardEmail: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  listCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  listCountText: {
    ...Typography.caption,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: Spacing.sm + 2,
  },
  actionPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  actionText: {
    ...Typography.bodySmall,
    fontWeight: '700',
  },
  centerState: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  centerTitle: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  centerBody: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  listsSheet: {
    paddingHorizontal: Spacing.lg,
    maxHeight: 440,
  },
  sheetTitle: {
    ...Typography.h4,
    color: Colors.light.text,
    marginBottom: Spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
  },
  addListButtonText: {
    ...Typography.caption,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  listName: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.light.text,
  },
  listMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
});
