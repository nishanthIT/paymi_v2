import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { certificateKeys, fetchCertificateAlerts } from '@/features/certificates/api';
import { fetchToday as fetchCleaningToday } from '@/features/cleaning/api';
import { cleaningKeys } from '@/features/cleaning/keys';
import { expiryKeys, fetchExpiryNotifications } from '@/features/expiry/api';
import { useIsOwner } from '@/features/shop-tools/hooks/use-is-owner';
import { useCanManageShopEmployees } from '@/features/employees/hooks';
import { useShopFeatures, type ShopFeature } from '@/features/employees/permissions';
import { fetchMyTasks, taskKeys } from '@/features/tasks/api';

interface ShopTool {
  route: Href;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  ownerOnly?: boolean;
  /** Shop permission an employee needs to see this tool. */
  feature?: ShopFeature;
  badge?: number;
  badgeColor?: string;
}

/** Profile tab: account info, shop tools dashboard and logout. */
export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const isOwner = useIsOwner();
  const canManageEmployees = useCanManageShopEmployees();
  const hasFeature = useShopFeatures();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Lightweight badge counts — pull-based and cached.
  const expiryAlerts = useQuery({
    queryKey: expiryKeys.notifications,
    queryFn: fetchExpiryNotifications,
    staleTime: 60_000,
    enabled: hasFeature('feature.expiry'),
  });
  const certificateAlerts = useQuery({
    queryKey: certificateKeys.alerts,
    queryFn: fetchCertificateAlerts,
    staleTime: 60_000,
    enabled: isOwner,
  });
  const cleaningToday = useQuery({
    queryKey: cleaningKeys.today,
    queryFn: fetchCleaningToday,
    staleTime: 60_000,
    enabled: hasFeature('feature.cleaning'),
  });
  const myTasks = useQuery({
    queryKey: taskKeys.mine,
    queryFn: fetchMyTasks,
    staleTime: 30_000,
    enabled: user?.userType === 'EMPLOYEE' && hasFeature('feature.tasks'),
  });
  const openTaskCount = (myTasks.data ?? []).filter((task) => !task.isCompleted).length;

  const cleaningRemaining = cleaningToday.data
    ? cleaningToday.data.summary.totalCount - cleaningToday.data.summary.completedCount
    : 0;

  const tools: ShopTool[] = (
    [
      {
        route: '/(app)/manage-expiry',
        label: 'Manage Expiry',
        icon: 'calendar-outline',
        feature: 'feature.expiry',
        badge: expiryAlerts.data?.length,
        badgeColor: Colors.light.error,
      },
      {
        route: '/(app)/task-management',
        label: 'Tasks',
        icon: 'checkbox-outline',
        feature: 'feature.tasks',
        badge: openTaskCount > 0 ? openTaskCount : undefined,
        badgeColor: Colors.light.primary,
      },
      { route: '/(app)/fridge-temperature', label: 'Temperature Log', icon: 'thermometer-outline', feature: 'feature.fridges' },
      {
        route: '/(app)/cleaning-status',
        label: 'Cleaning',
        icon: 'sparkles-outline',
        feature: 'feature.cleaning',
        badge: cleaningRemaining > 0 ? cleaningRemaining : undefined,
        badgeColor: Colors.light.warning,
      },
      { route: '/(app)/incident-logs', label: 'Incident Logs', icon: 'warning-outline', feature: 'feature.incidents' },
      {
        route: '/(app)/age-restriction-records',
        label: 'Age Restriction Records',
        icon: 'shield-checkmark-outline',
        feature: 'feature.age_records',
      },
      {
        route: '/(app)/certificate-management',
        label: 'Certificates',
        icon: 'ribbon-outline',
        ownerOnly: true,
        badge: certificateAlerts.data?.length,
        badgeColor: Colors.light.error,
      },
      { route: '/(app)/waste-management-record', label: 'Waste Log', icon: 'trash-outline', feature: 'feature.waste' },
      {
        route: '/(app)/supplier-payout-record',
        label: 'Supplier Payouts',
        icon: 'cash-outline',
        feature: 'feature.supplier_payouts',
      },
      { route: '/(app)/labels', label: 'Labels', icon: 'pricetags-outline' },
      { route: '/(app)/shift-sheet', label: 'Shift Sheet', icon: 'receipt-outline', feature: 'feature.shift_sheet' },
      { route: '/(app)/vat-calculator', label: 'VAT Calculator', icon: 'calculator-outline' },
      { route: '/(app)/profit-calculator', label: 'Profit Calculator', icon: 'trending-up-outline' },
    ] as ShopTool[]
  ).filter((tool) => (isOwner || !tool.ownerOnly) && hasFeature(tool.feature));

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await logout();
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={Colors.light.primary} />
          </View>
          <Text style={styles.name}>{user?.name ?? 'Your account'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {!!user?.userType && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {user.userType === 'CUSTOMER'
                  ? 'SHOP OWNER'
                  : user.userType === 'EMPLOYEE'
                    ? 'SHOP EMPLOYEE'
                    : String(user.userType)}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Shop Tools</Text>
        <View style={styles.grid}>
          {tools.map((tool) => (
            <ToolCard
              key={tool.label}
              tool={tool}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(tool.route);
              }}
            />
          ))}
        </View>

        <View style={styles.menu}>
          {canManageEmployees && (
            <MenuRow
              icon="people-outline"
              label="Shop Employees"
              onPress={() => router.push('/(app)/employees')}
            />
          )}
          <MenuRow
            icon="pricetag-outline"
            label="Report a Wrong Price"
            onPress={() => router.push('/(app)/report-price')}
          />
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            title="Log Out"
            onPress={handleLogout}
            loading={isLoggingOut}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToolCard({ tool, onPress }: { tool: ShopTool; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]}
    >
      <View style={styles.toolIcon}>
        <Ionicons name={tool.icon} size={22} color={Colors.light.primary} />
        {tool.badge != null && tool.badge > 0 && (
          <View
            style={[styles.toolBadge, { backgroundColor: tool.badgeColor ?? Colors.light.error }]}
          >
            <Text style={styles.toolBadgeText}>{tool.badge > 99 ? '99+' : tool.badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.toolLabel} numberOfLines={2}>
        {tool.label}
      </Text>
    </Pressable>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={19} color={Colors.light.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.light.textLight} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.light.text,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  toolCard: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    ...Shadows.sm,
  },
  toolCardPressed: {
    backgroundColor: Colors.light.primaryLight,
    transform: [{ scale: 0.97 }],
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  toolBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
  },
  toolLabel: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  menu: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.divider,
  },
  menuRowPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  name: {
    ...Typography.h3,
    color: Colors.light.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  email: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  badge: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
  },
  badgeText: {
    ...Typography.caption,
    color: Colors.light.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
  },
  cardText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    marginTop: Spacing.md,
  },
});
