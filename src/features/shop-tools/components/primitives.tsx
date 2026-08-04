import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Floating action button used by shop-tool list screens. */
export function Fab({
  icon = 'add',
  label,
  onPress,
  style,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  onPress: () => void;
  style?: ViewStyle;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      onPressIn={() => scale.set(withSpring(0.92, { damping: 16 }))}
      onPressOut={() => scale.set(withSpring(1, { damping: 16 }))}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.fab, label ? styles.fabExtended : null, animatedStyle, style]}
    >
      <Ionicons name={icon} size={24} color="#FFFFFF" />
      {!!label && <Text style={styles.fabLabel}>{label}</Text>}
    </AnimatedPressable>
  );
}

/** Card container for a single record row with press feedback. */
export function RecordCard({
  children,
  onPress,
  onLongPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
}) {
  if (!onPress && !onLongPress) {
    return <View style={[styles.card, style]}>{children}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      {children}
    </Pressable>
  );
}

/** Small caption line: "Added by Nishanth · 2 Aug 2026 · 10:15". */
export function AuditLine({ text }: { text: string }) {
  return (
    <View style={styles.auditRow}>
      <Ionicons name="person-circle-outline" size={13} color={Colors.light.textLight} />
      <Text style={styles.auditText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** Coloured status pill (e.g. EXPIRED, PAID, HIGH). */
export function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}1A`, borderColor: `${color}55` }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.xl,
    minWidth: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    ...Shadows.lg,
  },
  fabExtended: {
    paddingHorizontal: Spacing.lg,
  },
  fabLabel: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  cardPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  auditText: {
    ...Typography.caption,
    color: Colors.light.textLight,
    flexShrink: 1,
  },
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: {
    ...Typography.caption,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
