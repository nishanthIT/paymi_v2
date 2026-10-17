import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/ui/text-field';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { temperatureEntry } from '../temperature';

/** A decimal keypad plus visible sign buttons works on both iOS and Android. */
export function TemperatureField({ label, value, onChange, defaultNegative = false, autoFocus = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  defaultNegative?: boolean;
  autoFocus?: boolean;
}) {
  const [emptyNegative, setEmptyNegative] = useState(defaultNegative);
  const entry = temperatureEntry(value, value.trim() ? false : emptyNegative);
  const selectSign = (negative: boolean) => {
    setEmptyNegative(negative);
    onChange(`${negative ? '-' : '+'}${entry.magnitude}`);
  };

  return (
    <View>
      <View style={styles.signRow}>
        {[true, false].map((negative) => (
          <Pressable key={String(negative)} onPress={() => selectSign(negative)}
            accessibilityRole="button" accessibilityLabel={`${label}: ${negative ? 'negative' : 'positive'}`}
            accessibilityState={{ selected: entry.negative === negative }}
            style={[styles.sign, entry.negative === negative && styles.selected]}>
            <Text style={[styles.signText, entry.negative === negative && styles.selectedText]}>
              {negative ? '− Below 0' : '+ 0 or above'}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextField label={label} value={entry.magnitude} keyboardType="decimal-pad" autoFocus={autoFocus}
        accessibilityHint={`${entry.negative ? 'Negative' : 'Positive'} temperature. Use the sign buttons to change between below zero and above zero.`}
        placeholder={entry.negative ? 'e.g. 23' : 'e.g. 3.5'}
        onChangeText={(text) => {
          const next = temperatureEntry(text, entry.negative);
          setEmptyNegative(next.negative);
          onChange(next.text);
        }} />
    </View>
  );
}

const styles = StyleSheet.create({
  signRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  sign: { flex: 1, minHeight: 44, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.light.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  selected: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  signText: { ...Typography.caption, fontWeight: '600', color: Colors.light.textSecondary },
  selectedText: { color: '#FFFFFF' },
});
