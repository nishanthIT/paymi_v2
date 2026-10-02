import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LabelTokens as T } from '../tokens';

export type LabelsTabKey = 'new' | 'recent' | 'saved' | 'community';

const TABS: { key: LabelsTabKey; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'recent', label: 'Recent' },
  { key: 'saved', label: 'Saved' },
  { key: 'community', label: 'Community' },
];

/** New / Recent / Saved / Community tab strip — blue active with short thick underline. */
export function LabelsTabs({
  active,
  onChange,
}: {
  active: LabelsTabKey;
  onChange: (tab: LabelsTabKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.strip}
    >
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.tab}
          >
            <Text style={[styles.label, selected && styles.labelActive]}>{tab.label}</Text>
            <View style={[styles.underline, selected && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: T.bg,
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: T.divider,
  },
  row: {
    paddingHorizontal: T.insetPage,
    gap: 28,
  },
  tab: {
    alignItems: 'center',
    paddingTop: 2,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: T.textLight,
    paddingBottom: 8,
  },
  labelActive: {
    color: T.accent,
  },
  underline: {
    height: 4,
    width: 34,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: T.accent,
  },
});
