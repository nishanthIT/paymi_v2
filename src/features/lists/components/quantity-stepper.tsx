import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Typography } from '@/constants/theme';

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
}

/** Rounded quantity stepper. Never goes below `min` (default 1). */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  compact,
}: QuantityStepperProps) {
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) {
      Haptics.selectionAsync().catch(() => {});
      onChange(next);
    }
  };

  const size = compact ? 28 : 36;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Pressable
        onPress={() => step(-1)}
        disabled={value <= min}
        hitSlop={8}
        style={({ pressed }) => [
          styles.button,
          { width: size, height: size },
          pressed && styles.buttonPressed,
          value <= min && styles.buttonDisabled,
        ]}
      >
        <Ionicons
          name="remove"
          size={compact ? 16 : 20}
          color={value <= min ? Colors.light.buttonDisabledText : Colors.light.primary}
        />
      </Pressable>
      <Text style={[styles.value, compact && styles.valueCompact]}>{value}</Text>
      <Pressable
        onPress={() => step(1)}
        disabled={value >= max}
        hitSlop={8}
        style={({ pressed }) => [
          styles.button,
          { width: size, height: size },
          pressed && styles.buttonPressed,
        ]}
      >
        <Ionicons name="add" size={compact ? 16 : 20} color={Colors.light.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 3,
  },
  containerCompact: {
    padding: 2,
  },
  button: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: Colors.light.primaryLight,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  value: {
    ...Typography.bodyBold,
    color: Colors.light.text,
    minWidth: 36,
    textAlign: 'center',
  },
  valueCompact: {
    ...Typography.bodySmall,
    fontWeight: '700',
    minWidth: 28,
  },
});
