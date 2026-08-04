import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  color?: string;
}

interface OptionPickerProps<T extends string> {
  label?: string;
  options: PickerOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

/** Inline chip-select for small enums (severity, payment method, entry slot...). */
export function OptionPicker<T extends string>({ label, options, value, onChange }: OptionPickerProps<T>) {
  return (
    <View style={styles.container}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value;
          const tint = option.color ?? Colors.light.primary;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(option.value);
              }}
              style={[
                styles.chip,
                selected && { backgroundColor: tint, borderColor: tint },
              ]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    ...Typography.label,
    color: Colors.light.textSecondary,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundCard,
  },
  chipText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
});
