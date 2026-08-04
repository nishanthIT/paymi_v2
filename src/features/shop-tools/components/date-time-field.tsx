import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

interface DateTimeFieldProps {
  label: string;
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

function formatValue(value: Date | null, mode: 'date' | 'time'): string | null {
  if (!value) return null;
  return mode === 'date'
    ? value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Native date/time picker behind a themed field (Android dialog, iOS inline spinner). */
export function DateTimeField({
  label,
  mode,
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const display = formatValue(value, mode);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
      >
        <Ionicons
          name={mode === 'date' ? 'calendar-outline' : 'time-outline'}
          size={18}
          color={Colors.light.textSecondary}
        />
        <Text style={[styles.value, !display && styles.placeholder]}>
          {display ?? placeholder ?? (mode === 'date' ? 'Select date' : 'Select time')}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.light.textLight} />
      </Pressable>
      {open && (
        <>
          <DateTimePicker
            value={value ?? new Date()}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(event, date) => {
              if (Platform.OS === 'android') setOpen(false);
              if (event.type !== 'dismissed' && date) onChange(date);
            }}
            themeVariant="light"
          />
          {Platform.OS === 'ios' && (
            <Pressable style={styles.doneButton} onPress={() => setOpen(false)}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          )}
        </>
      )}
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
  },
  fieldPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  value: {
    ...Typography.body,
    color: Colors.light.text,
    flex: 1,
  },
  placeholder: {
    color: Colors.light.textLight,
  },
  doneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  doneText: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
});
