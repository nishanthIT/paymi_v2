import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

import {
  ACCESS_LEVELS,
  ALL_SHOP_PERMISSIONS,
  SHOP_FEATURE_OPTIONS,
  accessKey,
  accessSummary,
  setAccessLevel,
  type FeatureOption,
} from '../permissions';

interface EmployeeAccessEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
}

/** One expandable row per shop tool, with Read / Write / Edit switches inside. */
export function EmployeeAccessEditor({ value, onChange }: EmployeeAccessEditorProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const allOn = ALL_SHOP_PERMISSIONS.every((p) => value.includes(p));

  const renderTool = (option: FeatureOption) => {
    const open = expanded === option.value;
    const summary = accessSummary(value, option.value);
    const hasAccess = value.includes(option.value);
    return (
      <View key={option.value} style={styles.tool}>
        <Pressable
          onPress={() => setExpanded(open ? null : option.value)}
          style={({ pressed }) => [styles.toolHeader, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <View style={styles.toolIcon}>
            <Ionicons name={option.icon} size={17} color={Colors.light.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolLabel}>{option.label}</Text>
            <Text style={[styles.toolSummary, !hasAccess && styles.toolSummaryOff]}>{summary}</Text>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.light.textLight} />
        </Pressable>
        {open && (
          <Animated.View entering={FadeIn.duration(150)} style={styles.levels}>
            {ACCESS_LEVELS.map((level) => (
              <View key={level.level} style={styles.levelRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.levelLabel}>{level.label}</Text>
                  <Text style={styles.levelHint}>{level.hint}</Text>
                </View>
                <Switch
                  value={value.includes(accessKey(option.value, level.level))}
                  onValueChange={(on) => {
                    Haptics.selectionAsync().catch(() => {});
                    onChange(setAccessLevel(value, option.value, level.level, on));
                  }}
                  trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </Animated.View>
        )}
      </View>
    );
  };

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.section}>Access</Text>
        <Pressable onPress={() => onChange(allOn ? [] : [...ALL_SHOP_PERMISSIONS])} hitSlop={8}>
          <Text style={styles.toggleAll}>{allOn ? 'Clear all' : 'Full access'}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Tap a tool to choose Read, Write and Edit. Changes apply to this shop only.</Text>
      {SHOP_FEATURE_OPTIONS.map(renderTool)}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  section: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.text,
  },
  toggleAll: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  hint: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  tool: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
  },
  pressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  toolIcon: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.text,
  },
  toolSummary: {
    ...Typography.caption,
    color: Colors.light.primary,
  },
  toolSummaryOff: {
    color: Colors.light.textLight,
  },
  levels: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  levelLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.text,
  },
  levelHint: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
});
