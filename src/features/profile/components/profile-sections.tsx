import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Shadows } from '@/constants/theme';
import type { ProfileToolSection, ShopTool } from '../types';

const c = Colors.light;
const goldInk = '#79551F';
const softBorder = '#EAE3D7';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PROFILE_TOOL_SECTIONS: {
  id: ProfileToolSection;
  title: string;
  description: string;
}[] = [
  { id: 'daily', title: 'Daily operations', description: 'The essentials for a well-run shop.' },
  { id: 'records', title: 'Records & compliance', description: 'Safety and standards, all in one place.' },
  { id: 'business', title: 'Business tools', description: 'Labels, payments and everyday calculations.' },
];

/** Presentation-only feedback; the caller owns every action and its state. */
export function ProfileAction({
  children,
  onPress,
  label,
  hint,
  style,
  disabled = false,
  busy = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  busy?: boolean;
}) {
  const progress = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * 0.16,
    transform: [{ scale: 1 - progress.value * 0.015 }],
  }));
  const feedback = (value: number) => {
    progress.value = withTiming(value, { duration: 120, reduceMotion: ReduceMotion.System });
  };
  const accessibilityState: AccessibilityState = { disabled, busy };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => feedback(1)}
      onPressOut={() => feedback(0)}
      style={[style, animatedStyle, disabled && styles.disabled]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function ProfileIdentity({
  name,
  email,
  role,
  shopName,
  onOpenSupermarkets,
}: {
  name?: string;
  email?: string;
  role?: string;
  shopName?: string;
  onOpenSupermarkets: () => void;
}) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = [words[0], ...(words.length > 1 ? [words[words.length - 1]] : [])]
    .filter(Boolean)
    .map((word) => Array.from(word)[0])
    .join('')
    .toLocaleUpperCase();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;

  return (
    <Animated.View
      entering={FadeInDown.duration(260).reduceMotion(ReduceMotion.System)}
      style={styles.identityCard}
    >
      <View style={[styles.identity, stacked && styles.identityStacked]}>
        <View style={styles.avatarRing} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.avatar}>
            {initials ? <Text style={styles.initials} maxFontSizeMultiplier={1.3}>{initials}</Text> : <Ionicons name="person-outline" size={28} color={goldInk} />}
          </View>
        </View>
        <View style={styles.identityDetails}>
          <Text style={styles.name}>{name ?? 'Your account'}</Text>
          {!!email && <Text style={styles.email}>{email}</Text>}
          {!!role && (
            <View style={styles.roleBadge}>
              <View style={styles.roleDot} />
              <Text style={styles.roleText}>{role}</Text>
            </View>
          )}
        </View>
      </View>
      <ProfileAction
        label={shopName ? `My Supermarket, ${shopName}` : 'My Supermarket'}
        hint="Open your supermarkets to view or switch shops"
        onPress={onOpenSupermarkets}
        style={styles.shopCard}
      >
        <View style={styles.shopIcon}><Ionicons name="storefront-outline" size={23} color={c.accent} /></View>
        <View style={styles.flex}>
          <Text style={styles.shopEyebrow}>My Supermarket</Text>
          <Text style={styles.shopName}>{shopName || 'Choose and manage your shops'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={c.accent} />
      </ProfileAction>
    </Animated.View>
  );
}

export function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        {!!description && <Text style={styles.sectionDescription}>{description}</Text>}
      </View>
      {children}
    </View>
  );
}

export function ProfileToolGrid({
  tools,
  section,
  onPress,
}: {
  tools: ShopTool[];
  section: ProfileToolSection;
  onPress: (tool: ShopTool) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  // Keep long labels readable at narrow widths and with larger system text.
  const needsSingleColumn = fontScale > 1.5 || (width < 360 && fontScale > 1.15);
  const columns = needsSingleColumn ? 1 : section === 'business' && width >= 390 && fontScale <= 1.15 ? 3 : 2;
  const featured = section === 'daily';
  const rows = Array.from({ length: Math.ceil(tools.length / columns) }, (_, index) =>
    tools.slice(index * columns, (index + 1) * columns),
  );

  return (
    <View style={[styles.toolGrid, !featured && styles.toolPanel]}>
      {rows.map((row, rowIndex) => (
        <View key={row[0].label} style={[styles.toolRow, featured && styles.featuredRow, !featured && rowIndex > 0 && styles.topDivider]}>
          {row.map((tool, columnIndex) => {
            const badge = tool.badge != null && tool.badge > 0 ? tool.badge : 0;
            return (
              <ProfileAction
                key={tool.label}
                onPress={() => onPress(tool)}
                label={badge ? `${tool.label}, ${badge} outstanding` : tool.label}
                style={[
                  styles.tool,
                  featured ? styles.featuredTool : styles.compactTool,
                  section === 'records' && styles.recordTool,
                  !featured && columnIndex > 0 && styles.leftDivider,
                ]}
              >
                <View style={[styles.toolIcon, !featured && styles.compactIcon]}>
                  <Ionicons name={tool.icon} size={featured ? 23 : 21} color={goldInk} />
                  {!featured && badge > 0 && <ToolBadge tool={tool} onIcon />}
                </View>
                <Text style={[styles.toolLabel, !featured && styles.compactLabel]}>{tool.label}</Text>
                {featured && badge > 0 && <ToolBadge tool={tool} />}
                {featured && <Ionicons name="arrow-forward" size={17} color={goldInk} style={styles.toolArrow} />}
              </ProfileAction>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function ToolBadge({ tool, onIcon = false }: { tool: ShopTool; onIcon?: boolean }) {
  const count = tool.badge ?? 0;
  return (
    <View style={[styles.toolBadge, onIcon && styles.iconBadge, { backgroundColor: tool.badgeColor ?? c.error }]}>
      <Text
        // The full count is already announced in the parent button's label.
        maxFontSizeMultiplier={1.3}
        style={[styles.toolBadgeText, (tool.badgeColor === c.primary || tool.badgeColor === c.warning) && styles.darkBadgeText]}
      >
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export function ProfileMenu({ children }: { children: React.ReactNode }) {
  return <View style={styles.menu}>{children}</View>;
}

export function ProfileMenuRow({
  icon,
  label,
  description,
  onPress,
  last = false,
  destructive = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
  last?: boolean;
  destructive?: boolean;
}) {
  return (
    <ProfileAction label={label} onPress={onPress} style={styles.menuRow}>
      <View style={[styles.menuIcon, destructive && styles.destructiveIcon]}>
        <Ionicons name={icon} size={21} color={destructive ? c.error : goldInk} />
      </View>
      <View style={[styles.menuCopy, !last && styles.menuDivider]}>
        <View style={styles.flex}>
          <Text style={[styles.menuLabel, destructive && styles.destructiveText]}>{label}</Text>
          {!!description && <Text style={styles.menuDescription}>{description}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={17} color={c.textSecondary} />
      </View>
    </ProfileAction>
  );
}

export function ProfileLogout({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  return (
    <ProfileAction label={busy ? 'Logging out…' : 'Log Out'} onPress={onPress} disabled={busy} busy={busy} style={styles.logout}>
      {busy ? <ActivityIndicator size="small" color={c.text} /> : <Ionicons name="log-out-outline" size={21} color={c.text} />}
      <Text style={styles.logoutText}>{busy ? 'Logging out…' : 'Log Out'}</Text>
    </ProfileAction>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  disabled: { opacity: 0.55 },
  identityCard: { backgroundColor: c.backgroundCard, borderRadius: 24, borderWidth: 1, borderColor: softBorder, ...Shadows.sm },
  identity: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  identityStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  identityDetails: { flex: 1, minWidth: 0, gap: 5, alignSelf: 'stretch', justifyContent: 'center' },
  avatarRing: { padding: 4, borderRadius: 36, borderWidth: 1, borderColor: c.accent },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 23, fontWeight: '700', color: goldInk, letterSpacing: -0.6 },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.6, color: c.text },
  email: { fontSize: 13, lineHeight: 20, color: c.textSecondary, flexShrink: 1 },
  roleBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.backgroundSecondary, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, marginTop: 4, maxWidth: '100%' },
  roleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: goldInk },
  roleText: { fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8, color: goldInk, flexShrink: 1 },
  shopCard: { backgroundColor: c.text, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, margin: 5, marginTop: 0, borderRadius: 19, minHeight: 82 },
  shopIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#453C2E', alignItems: 'center', justifyContent: 'center' },
  shopEyebrow: { color: c.accent, fontSize: 11, lineHeight: 17, fontWeight: '600', letterSpacing: 0.4 },
  shopName: { color: c.backgroundSecondary, fontSize: 16, lineHeight: 22, fontWeight: '600', marginTop: 2 },
  section: { gap: 12 },
  sectionHeading: { gap: 3 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.3, color: c.text },
  sectionDescription: { fontSize: 12, lineHeight: 18, color: c.textSecondary },
  toolGrid: { gap: 10 },
  toolPanel: { backgroundColor: c.backgroundCard, borderWidth: 1, borderColor: softBorder, borderRadius: 20, padding: 6, gap: 0 },
  toolRow: { flexDirection: 'row', alignItems: 'stretch' },
  featuredRow: { gap: 10 },
  tool: { flex: 1, minWidth: 0, position: 'relative' },
  featuredTool: { backgroundColor: c.backgroundCard, borderWidth: 1, borderColor: softBorder, borderRadius: 19, padding: 15, paddingRight: 30, minHeight: 112, gap: 12, ...Shadows.sm },
  compactTool: { padding: 12, gap: 8, minHeight: 102 },
  recordTool: { flexDirection: 'row', alignItems: 'center', minHeight: 82, gap: 9, paddingHorizontal: 10 },
  topDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: softBorder },
  leftDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: softBorder },
  toolIcon: { alignSelf: 'flex-start', flexShrink: 0, width: 38, height: 38, borderRadius: 12, backgroundColor: c.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  compactIcon: { width: 32, height: 32, borderRadius: 10, alignSelf: 'auto' },
  toolLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: c.text, flexShrink: 1, minWidth: 0 },
  compactLabel: { fontSize: 12, lineHeight: 18 },
  toolArrow: { position: 'absolute', right: 12, bottom: 17 },
  toolBadge: { position: 'absolute', top: 10, right: 10, minWidth: 21, minHeight: 21, paddingVertical: 2, paddingHorizontal: 5, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  iconBadge: { top: -8, right: -5, minWidth: 18, minHeight: 18, paddingVertical: 0, paddingHorizontal: 4, borderWidth: 1.5, borderColor: c.backgroundCard },
  toolBadgeText: { fontSize: 10, lineHeight: 15, fontWeight: '800', color: '#FFFFFF' },
  darkBadgeText: { color: '#211B13' },
  menu: { backgroundColor: c.backgroundCard, borderRadius: 20, borderWidth: 1, borderColor: softBorder, paddingHorizontal: 15 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  menuIcon: { backgroundColor: c.backgroundSecondary, width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 17 },
  menuDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: softBorder },
  menuLabel: { color: c.text, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  menuDescription: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  destructiveIcon: { backgroundColor: '#FCF0ED' },
  destructiveText: { color: c.error },
  logout: { minHeight: 54, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  logoutText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: c.text, flexShrink: 1 },
});
