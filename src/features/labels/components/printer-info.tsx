import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';

import { LabelTokens as T } from '../tokens';

export interface PrintCapability {
  key: string;
  label: string;
  detail: string;
  available: boolean;
}

/** What this device can actually do — no printer models are claimed. */
export async function detectPrintCapabilities(os = Platform.OS): Promise<PrintCapability[]> {
  const share = os === 'web' ? false : await Sharing.isAvailableAsync().catch(() => false);
  const systemRoute =
    os === 'ios'
      ? 'AirPrint printers and printer apps through the iOS print sheet'
      : os === 'android'
        ? 'Printers set up in Android’s print services'
        : 'Your browser’s print dialog, including “Save as PDF”';
  return [
    { key: 'pdf', label: 'PDF at exact size', detail: 'Every label, sheet and strip is made as a true-size PDF.', available: true },
    { key: 'system', label: 'System print', detail: systemRoute, available: os === 'ios' || os === 'android' || os === 'web' },
    {
      key: 'share',
      label: 'Save or share the PDF',
      detail: share ? 'Files, email, or your label printer’s own app' : os === 'web' ? 'Use “Save as PDF” in the print dialog' : 'Not available on this device',
      available: share || os === 'web',
    },
    {
      key: 'direct',
      label: 'Direct label printer',
      detail: 'Bluetooth, USB or network label printers can’t be connected to PayMi yet.',
      available: false,
    },
  ];
}

export function usePrintCapabilities() {
  const [caps, setCaps] = useState<PrintCapability[] | null>(null);
  useEffect(() => {
    let alive = true;
    detectPrintCapabilities().then((c) => alive && setCaps(c));
    return () => {
      alive = false;
    };
  }, []);
  return caps;
}

export function CapabilityList() {
  const caps = usePrintCapabilities();
  if (!caps) return null;
  return (
    <View style={styles.list}>
      {caps.map((c) => (
        <View key={c.key} style={styles.capRow}>
          <Ionicons name={c.available ? 'checkmark-circle' : 'close-circle-outline'} size={22} color={c.available ? T.success : T.textLight} />
          <View style={styles.flex}>
            <Text style={styles.capTitle}>
              {c.label}
              <Text style={styles.capState}>{c.available ? ' · Available' : ' · Not available'}</Text>
            </Text>
            <Text style={styles.capDetail}>{c.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Printer & PDF help (inferred): capability-based, lists no untested models. */
export function PrinterInfoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable sheetStyle={styles.sheet}>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="printer-outline" size={24} color={T.text} />
          <Text style={styles.title}>Printing labels</Text>
        </View>
        <Text style={styles.body}>What works on this device:</Text>
        <CapabilityList />
        <Text style={styles.heading}>Getting the size right</Text>
        <Text style={styles.body}>
          Print at 100% (“Actual size”) and turn off “Fit to page”, so labels come out at their real size. Load the
          sheet or roll that matches the label you chose.
        </Text>
        <Text style={styles.heading}>Colour</Text>
        <Text style={styles.body}>
          Thermal label printers print black only. Red and yellow designs need a colour printer, or pre-coloured
          labels.
        </Text>
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Got it</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  sheet: {
    backgroundColor: T.bg,
  },
  content: {
    padding: 20,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 19,
    fontWeight: '600',
    color: T.text,
  },
  heading: {
    fontSize: 15.5,
    fontWeight: '600',
    color: T.text,
    marginTop: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: T.textSecondary,
  },
  list: {
    gap: 12,
    backgroundColor: T.surfaceAlt,
    borderRadius: 12,
    padding: 12,
  },
  capRow: {
    flexDirection: 'row',
    gap: 10,
  },
  capTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: T.text,
  },
  capState: {
    fontWeight: '400',
    color: T.textSecondary,
  },
  capDetail: {
    fontSize: 13,
    lineHeight: 18,
    color: T.textSecondary,
    marginTop: 2,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 16,
    color: T.accent,
  },
});
