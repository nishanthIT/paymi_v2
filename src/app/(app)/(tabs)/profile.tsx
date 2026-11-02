import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { certificateKeys, fetchCertificateAlerts } from '@/features/certificates/api';
import { fetchToday as fetchCleaningToday } from '@/features/cleaning/api';
import { cleaningKeys } from '@/features/cleaning/keys';
import { expiryKeys, fetchExpiryNotifications } from '@/features/expiry/api';
import { useIsOwner } from '@/features/shop-tools/hooks/use-is-owner';
import { useCanManageShopEmployees } from '@/features/employees/hooks';
import { useShopFeatures } from '@/features/employees/permissions';
import {
  PROFILE_TOOL_SECTIONS,
  ProfileIdentity,
  ProfileLogout,
  ProfileMenu,
  ProfileMenuRow,
  ProfileSection,
  ProfileToolGrid,
} from '@/features/profile/components/profile-sections';
import type { ShopTool } from '@/features/profile/types';
import { fetchMyTasks, taskKeys } from '@/features/tasks/api';

/** Profile tab: account info, shop tools dashboard and logout. */
export default function ProfileScreen() {
  const { user, logout, activeSupermarket } = useAuth();
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
        section: 'daily',
        icon: 'calendar-outline',
        feature: 'feature.expiry',
        badge: expiryAlerts.data?.length,
        badgeColor: Colors.light.error,
      },
      {
        route: '/(app)/task-management',
        label: 'Tasks',
        section: 'daily',
        icon: 'checkbox-outline',
        feature: 'feature.tasks',
        badge: openTaskCount > 0 ? openTaskCount : undefined,
        badgeColor: Colors.light.primary,
      },
      { route: '/(app)/fridge-temperature', label: 'Temperature Log', section: 'daily', icon: 'thermometer-outline', feature: 'feature.fridges' },
      {
        route: '/(app)/cleaning-status',
        label: 'Cleaning',
        section: 'daily',
        icon: 'sparkles-outline',
        feature: 'feature.cleaning',
        badge: cleaningRemaining > 0 ? cleaningRemaining : undefined,
        badgeColor: Colors.light.warning,
      },
      { route: '/(app)/incident-logs', label: 'Incident Logs', section: 'records', icon: 'warning-outline', feature: 'feature.incidents' },
      {
        route: '/(app)/age-restriction-records',
        label: 'Age Restriction Records',
        section: 'records',
        icon: 'shield-checkmark-outline',
        feature: 'feature.age_records',
      },
      {
        route: '/(app)/certificate-management',
        label: 'Certificates',
        section: 'records',
        icon: 'ribbon-outline',
        ownerOnly: true,
        badge: certificateAlerts.data?.length,
        badgeColor: Colors.light.error,
      },
      { route: '/(app)/waste-management-record', label: 'Waste Log', section: 'records', icon: 'trash-outline', feature: 'feature.waste' },
      {
        route: '/(app)/supplier-payout-record',
        label: 'Supplier Payouts',
        section: 'business',
        icon: 'cash-outline',
        feature: 'feature.supplier_payouts',
      },
      { route: '/(app)/labels', label: 'Labels', section: 'business', icon: 'pricetags-outline' },
      { route: '/(app)/shift-sheet', label: 'Shift Sheet', section: 'business', icon: 'receipt-outline', feature: 'feature.shift_sheet' },
      { route: '/(app)/vat-calculator', label: 'VAT Calculator', section: 'business', icon: 'calculator-outline' },
      { route: '/(app)/profit-calculator', label: 'Profit Calculator', section: 'business', icon: 'trending-up-outline' },
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
          } catch (error) {
            Alert.alert('Sign-out storage issue', error instanceof Error ? error.message : 'Could not erase saved sign-in data. Please retry.');
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <View style={styles.headingAccent} />
          <Text accessibilityRole="header" style={styles.title}>Profile</Text>
        </View>

        <ProfileIdentity
          name={user?.name}
          email={user?.email}
          role={user?.userType
            ? user.userType === 'CUSTOMER'
              ? 'SHOP OWNER'
              : user.userType === 'EMPLOYEE'
                ? 'SHOP EMPLOYEE'
                : String(user.userType)
            : undefined}
          shopName={activeSupermarket?.name}
          onOpenSupermarkets={() => router.push('/(app)/supermarkets')}
        />

        {PROFILE_TOOL_SECTIONS.map((section) => {
          const sectionTools = tools.filter((tool) => tool.section === section.id);
          if (!sectionTools.length) return null;
          return (
            <ProfileSection key={section.id} title={section.title} description={section.description}>
              <ProfileToolGrid
                tools={sectionTools}
                section={section.id}
                onPress={(tool) => {
                  Haptics.selectionAsync();
                  router.push(tool.route);
                }}
              />
            </ProfileSection>
          );
        })}

        <ProfileSection title="Shop & support">
          <ProfileMenu>
            {canManageEmployees && (
              <ProfileMenuRow
                icon="people-outline"
                label="Shop Employees"
                description="Your team and their shop access"
                onPress={() => router.push('/(app)/employees')}
              />
            )}
            <ProfileMenuRow icon="pricetag-outline" label="Report a Wrong Price" onPress={() => router.push('/(app)/report-price')} />
            <ProfileMenuRow icon="information-circle-outline" label="About PayMi" last onPress={() => router.push('/about')} />
          </ProfileMenu>
        </ProfileSection>

        <ProfileSection title="Privacy & account">
          <ProfileMenu>
            <ProfileMenuRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push({ pathname: '/about', params: { privacy: '1' } })} />
            <ProfileMenuRow icon="trash-outline" label="Delete Personal Account" destructive last onPress={() => router.push('/account-deletion')} />
          </ProfileMenu>
          <ProfileLogout busy={isLoggingOut} onPress={handleLogout} />
        </ProfileSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 26,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: -8 },
  headingAccent: { width: 4, height: 24, borderRadius: 2, backgroundColor: Colors.light.primary },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8, color: Colors.light.text },
});
