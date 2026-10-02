import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LabelsScreen } from './labels-screen';
import { LabelTokens as T } from '../tokens';

/**
 * Temporary destination body used until a tool's batch is implemented.
 * Honest placeholder — performs no fake lookups, saves or prints.
 */
export function ToolPlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <LabelsScreen title={title}>
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="construct-outline" size={26} color={T.textLight} />
        </View>
        <Text style={styles.title}>Not available yet</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
    </LabelsScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: T.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: T.fontCardTitle,
    fontWeight: '700',
    color: T.text,
  },
  note: {
    fontSize: T.fontBody,
    color: T.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
