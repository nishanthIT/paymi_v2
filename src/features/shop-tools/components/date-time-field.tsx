import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

interface DateTimeFieldProps {
  label: string;
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Open the picker as soon as the field mounts (native only). */
  autoOpen?: boolean;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function formatValue(value: Date | null, mode: 'date' | 'time'): string | null {
  if (!value) return null;
  if (mode === 'time') {
    return value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  const text = value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return isSameDay(value, new Date()) ? `Today · ${text}` : text;
}

function clamp(date: Date, min?: Date, max?: Date): Date {
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
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
  autoOpen,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(() => !!autoOpen && Platform.OS !== 'web');
  // What the picker is showing; committed on Done so an untouched picker still saves its date.
  const [draft, setDraft] = useState<Date>(() => clamp(value ?? new Date(), minimumDate, maximumDate));
  const display = formatValue(value, mode);

  const openPicker = () => {
    Keyboard.dismiss();
    setDraft(clamp(value ?? new Date(), minimumDate, maximumDate));
    setOpen(true);
  };

  const confirm = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={open ? confirm : openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display ?? 'not set'}`}
        style={({ pressed }) => [
          styles.field,
          open && styles.fieldOpen,
          pressed && styles.fieldPressed,
        ]}
      >
        <Ionicons
          name={mode === 'date' ? 'calendar-outline' : 'time-outline'}
          size={18}
          color={open ? Colors.light.primary : Colors.light.textSecondary}
        />
        <Text style={[styles.value, !display && styles.placeholder]}>
          {display ?? placeholder ?? (mode === 'date' ? 'Select date' : 'Select time')}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.light.textLight}
        />
      </Pressable>
      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={draft}
          mode={mode}
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === 'set' && date) onChange(date);
          }}
        />
      )}
      {open && Platform.OS === 'ios' && (
        <View style={styles.iosPicker}>
          <DateTimePicker
            value={draft}
            mode={mode}
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_event, date) => {
              if (!date) return;
              setDraft(date);
              onChange(date);
            }}
            themeVariant="light"
          />
          <Pressable style={styles.doneButton} onPress={confirm} hitSlop={8}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
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
  fieldOpen: {
    borderColor: Colors.light.primary,
  },
  iosPicker: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundCard,
    overflow: 'hidden',
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
    paddingVertical: Spacing.sm,
  },
  doneText: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
});
