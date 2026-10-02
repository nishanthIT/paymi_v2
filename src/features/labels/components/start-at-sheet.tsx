import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';

import type { GridSheet } from '../render/sheet-layout';
import { cellsPerSheet } from '../render/sheet-layout';
import { LabelTokens as T } from '../tokens';

/**
 * Start-at selector (inferred screen): the sheet's numbered cells in print
 * order. Cells before the chosen one are shown as already used.
 */
export function StartAtSheet({
  visible,
  sheet,
  value,
  onApply,
  onClose,
}: {
  visible: boolean;
  sheet: GridSheet;
  value: number;
  onApply: (cell: number) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(value);
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setSelected(value);
  }
  const cells = cellsPerSheet(sheet);

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable sheetStyle={styles.sheet}>
      <View style={styles.content}>
        <Text style={styles.title}>Start at</Text>
        <Text style={styles.body}>
          Pick the first empty label on your sheet. Labels before it are left blank so you can reuse a
          part-used sheet.
        </Text>
        <View style={styles.grid}>
          {Array.from({ length: cells }, (_, i) => {
            const cell = i + 1;
            const isSelected = cell === selected;
            const used = cell < selected;
            return (
              <Pressable
                key={cell}
                onPress={() => setSelected(cell)}
                accessibilityRole="button"
                accessibilityLabel={`Start at label ${cell}`}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.cell,
                  { width: `${100 / sheet.columns}%` },
                  used && styles.cellUsed,
                  isSelected && styles.cellSelected,
                ]}
              >
                <Text style={[styles.cellText, used && styles.cellTextUsed, isSelected && styles.cellTextSelected]}>
                  {cell}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.summary}>
          {selected > 1 ? `Label ${selected} — ${selected - 1} already used` : 'Label 1 — a fresh sheet'}
        </Text>
        <Pressable
          onPress={() => {
            onApply(selected);
            onClose();
          }}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Apply</Text>
        </Pressable>
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

/**
 * Sheet chooser (inferred screen). Lists only stocks that exist in real
 * configuration — today that is the single reference sheet.
 */
export function ChangeSheetSheet({
  visible,
  options,
  selectedId,
  onPick,
  onClose,
  title = 'Label sheet',
  body = 'Match this to the sheets loaded in your printer.',
}: {
  visible: boolean;
  options: { id: string; title: string; subtitle: string }[];
  selectedId: string;
  onPick: (id: string) => void;
  onClose: () => void;
  title?: string;
  body?: string;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {options.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => {
              onPick(option.id);
              onClose();
            }}
            style={styles.optionRow}
            accessibilityRole="radio"
            accessibilityState={{ selected: option.id === selectedId }}
          >
            <MaterialCommunityIcons name="grid" size={24} color={T.text} />
            <View style={styles.flex}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </View>
            {option.id === selectedId && <Ionicons name="checkmark" size={22} color={T.accent} />}
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: T.bg,
  },
  content: {
    gap: 12,
    paddingBottom: 6,
  },
  flex: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: T.text,
  },
  body: {
    fontSize: 14.5,
    lineHeight: 20,
    color: T.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: T.labelOutline,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 4,
  },
  cell: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  cellUsed: {
    backgroundColor: T.bg,
  },
  cellSelected: {
    backgroundColor: T.accent,
  },
  cellText: {
    fontSize: 15,
    fontWeight: '600',
    color: T.text,
  },
  cellTextUsed: {
    color: T.textLight,
    textDecorationLine: 'line-through',
  },
  cellTextSelected: {
    color: '#FFFFFF',
  },
  summary: {
    fontSize: 14.5,
    color: T.text,
    textAlign: 'center',
  },
  primary: {
    minHeight: 52,
    borderRadius: T.radiusButton,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: T.accent,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.divider,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: T.text,
  },
  optionSubtitle: {
    fontSize: 13.5,
    color: T.textSecondary,
    marginTop: 2,
  },
});
