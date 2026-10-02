import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LabelTokens as T } from '../tokens';

/** Two large black side-by-side buttons: barcode + Scan, magnifier + Search (R16/R21). */
export function ScanSearchButtons({ onScan, onSearch }: { onScan: () => void; onSearch: () => void }) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onScan}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="barcode-scan" size={20} color="#FFFFFF" />
        <Text style={styles.label}>Scan</Text>
      </Pressable>
      <Pressable
        onPress={onSearch}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Ionicons name="search" size={19} color="#FFFFFF" />
        <Text style={styles.label}>Search</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 54,
    borderRadius: T.radiusButton,
    backgroundColor: T.buttonDark,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
