import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import type { Employee, EmployeeInput } from '@/features/employees/api';
import { EmployeeFormSheet } from '@/features/employees/components/employee-form-sheet';
import { monogram } from '@/features/employees/format';
import {
  useCanManageShopEmployees,
  useCreateEmployee,
  useDeleteEmployee,
  useEmployees,
  useSetEmployeeStatus,
  useUpdateEmployee,
} from '@/features/employees/hooks';
import { SHOP_FEATURE_OPTIONS } from '@/features/employees/permissions';
import { matchesSearch } from '@/utils/search';

/** Shop Employees (shop owner only). Memberships in this shop; never company/admin access. */
export default function EmployeesScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const canManage = useCanManageShopEmployees();
  const employeesQuery = useEmployees(canManage);
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const statusMutation = useSetEmployeeStatus();

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const filtered = useMemo(() => {
    const term = search.trim();
    return term ? employees.filter((e) => matchesSearch(term, e.name, e.email)) : employees;
  }, [employees, search]);
  const totalLists = employees.reduce((sum, e) => sum + (e.listCount ?? 0), 0);
  const statusOf = (e: Employee) => e.status ?? 'ACTIVE';
  const activeCount = employees.filter((e) => statusOf(e) === 'ACTIVE').length;
  const inactiveCount = employees.filter((e) => statusOf(e) === 'INACTIVE').length;

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
        'Remove from shop?',
        `${employee.name} will lose access to this shop immediately. Their account and lists are kept.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () =>
              deleteMutation.mutate(employee.id, {
                onSuccess: () => showToast('Employee removed from shop', 'success'),
                onError: (error: any) => {
                  if (!error?.silent) showToast(error?.message ?? 'Remove failed', 'error');
                },
              }),
          },
        ],
      );
    },
    [deleteMutation, showToast],
  );

  const handleToggleStatus = useCallback(
    (employee: Employee) => {
      const status = (employee.status ?? 'ACTIVE') === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      statusMutation.mutate(
        { id: employee.id, status },
        {
          onSuccess: () =>
            showToast(status === 'ACTIVE' ? 'Employee reactivated' : 'Employee deactivated', 'success'),
          onError: (error: any) => {
            if (!error?.silent) showToast(error?.message ?? 'Could not change status', 'error');
          },
        },
      );
    },
    [statusMutation, showToast],
  );

  if (!canManage) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.centerState}>
          <Ionicons name="lock-closed-outline" size={40} color={Colors.light.textLight} />
          <Text style={styles.centerTitle}>Shop owner only</Text>
          <Text style={styles.centerBody}>Shop employees are managed by the shop owner.</Text>
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

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.light.textLight} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search employees by name or email"
          placeholderTextColor={Colors.light.textLight}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.light.textLight} />
          </Pressable>
        )}
      </View>

      <Animated.View entering={FadeInUp.duration(350)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{inactiveCount}</Text>
          <Text style={styles.statLabel}>Inactive</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalLists}</Text>
          <Text style={styles.statLabel}>Lists</Text>
        </View>
      </Animated.View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={employeesQuery.isRefetching}
            onRefresh={() => employeesQuery.refetch()}
            tintColor={Colors.light.primary}
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.duration(250).delay(Math.min(index, 8) * 40)}
            layout={LinearTransition.springify().damping(26)}
          >
            <EmployeeCard
              employee={item}
              onOpen={() => router.push(`/employee/${item.id}` as Href)}
              onEdit={() => {
                setEditing(item);
                setFormVisible(true);
              }}
              onToggleStatus={() => handleToggleStatus(item)}
              onDelete={() => handleDelete(item)}
            />
          </Animated.View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          employeesQuery.isPending ? null : search ? (
            <View style={styles.centerState}>
              <Ionicons name="search-outline" size={40} color={Colors.light.textLight} />
              <Text style={styles.centerTitle}>No matches</Text>
              <Text style={styles.centerBody}>No employee matches “{search.trim()}”.</Text>
            </View>
          ) : (
            <View style={styles.centerState}>
              <Ionicons name="people-outline" size={40} color={Colors.light.textLight} />
              <Text style={styles.centerTitle}>No shop employees yet</Text>
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
      <Text style={styles.title}>Shop Employees</Text>
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
  onOpen,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  employee: Employee;
  onOpen: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  // Servers without shop memberships report no status; treat those as active and hide status actions.
  const status = employee.status ?? 'ACTIVE';
  const supportsStatus = !!employee.membershipId;
  const inactive = status !== 'ACTIVE';
  const toolCount = SHOP_FEATURE_OPTIONS.filter((o) => employee.permissions?.includes(o.value)).length;
  return (
    <View style={[styles.card, inactive && styles.cardInactive]}>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.cardTop, pressed && styles.cardTopPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${employee.name}'s lists and tasks`}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{monogram(employee.name)}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>
            {employee.name}
          </Text>
          <Text style={styles.cardEmail} numberOfLines={1}>
            {employee.email}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {status === 'ACTIVE' ? 'Active' : status === 'INVITED' ? 'Invited' : 'Inactive'} · {toolCount}/
            {SHOP_FEATURE_OPTIONS.length} tools
          </Text>
        </View>
        <View style={styles.listCountPill}>
          <Ionicons name="list" size={12} color={Colors.light.primary} />
          <Text style={styles.listCountText}>{employee.listCount}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.light.textLight} />
      </Pressable>
      <View style={styles.cardActions}>
        <CardAction icon="create-outline" label="Edit" onPress={onEdit} />
        {supportsStatus && (
          <CardAction
            icon={inactive ? 'play-circle-outline' : 'pause-circle-outline'}
            label={inactive ? 'Activate' : 'Deactivate'}
            onPress={onToggleStatus}
          />
        )}
        <CardAction icon="person-remove-outline" label="Remove" destructive onPress={onDelete} />
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.actionText, { color }]} numberOfLines={1}>
        {label}
      </Text>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.light.text,
    paddingVertical: 0,
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
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
    ...Shadows.sm,
  },
  statValue: {
    ...Typography.h3,
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
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  cardTopPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardName: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  cardEmail: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  cardMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  cardInactive: {
    opacity: 0.7,
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
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xs,
  },
  actionPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  actionText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    flexShrink: 1,
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
});
