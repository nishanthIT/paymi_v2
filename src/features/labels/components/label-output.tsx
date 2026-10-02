import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useToast } from '@/components/ui/toast';

import { canShareFiles, outputLabels, outputMessage, type OutputJob, type OutputRoute, type OutputStatus } from '../export/output';
import { LabelTokens as T } from '../tokens';

type Pending = { job: OutputJob; onResult?: (status: OutputStatus) => void };

/**
 * Start an output job. Web goes straight to the browser print dialog; native
 * asks Print or Save/share. Repeated taps while a job runs are ignored.
 */
export function useLabelOutput() {
  const { showToast } = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = async ({ job, onResult }: Pending, route: OutputRoute) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setPending(null);
    try {
      const status = await outputLabels(job, route);
      const msg = outputMessage(status);
      showToast(msg.text, msg.type);
      onResult?.(status);
    } catch (e: any) {
      showToast(e?.message ? `Couldn’t print: ${e.message}` : 'Couldn’t print', 'error');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const start = (job: OutputJob, onResult?: (status: OutputStatus) => void) => {
    if (busyRef.current) return;
    if (!canShareFiles()) run({ job, onResult }, 'print');
    else setPending({ job, onResult });
  };

  const first = pending?.job.pages[0];
  const sheet = (
    <BottomSheet visible={!!pending} onClose={() => setPending(null)} sheetStyle={styles.sheet}>
      <View style={styles.content}>
        <Text style={styles.title}>{pending?.job.title}</Text>
        {first && (
          <Text style={styles.body}>
            {pending!.job.pages.length} {pending!.job.pages.length === 1 ? 'page' : 'pages'} · {first.widthMm} × {first.heightMm} mm · prints at
            100%, never fitted to the paper
          </Text>
        )}
        <Pressable onPress={() => pending && run(pending, 'print')} style={({ pressed }) => [styles.option, pressed && styles.pressed]} accessibilityRole="button">
          <MaterialCommunityIcons name="printer-outline" size={24} color={T.text} />
          <View style={styles.flex}>
            <Text style={styles.optionTitle}>Print</Text>
            <Text style={styles.optionBody}>{Platform.OS === 'ios' ? 'AirPrint and printer apps' : 'Android print services'}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => pending && run(pending, 'share')} style={({ pressed }) => [styles.option, pressed && styles.pressed]} accessibilityRole="button">
          <MaterialCommunityIcons name="file-pdf-box" size={24} color={T.text} />
          <View style={styles.flex}>
            <Text style={styles.optionTitle}>Save or share PDF</Text>
            <Text style={styles.optionBody}>Files, email, or your label printer’s own app</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setPending(null)} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );

  return { start, busy, sheet };
}

/** Wide blue print action used at the end of editors without a reference print control. */
export function PrintAction({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.action, (pressed || busy) && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ busy }}
    >
      <MaterialCommunityIcons name="printer" size={22} color="#FFFFFF" />
      <Text style={styles.actionText}>{busy ? 'Preparing…' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  sheet: {
    backgroundColor: T.bg,
  },
  content: {
    padding: 20,
    gap: 8,
  },
  title: {
    fontSize: 19,
    fontWeight: '600',
    color: T.text,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 19,
    color: T.textSecondary,
    marginBottom: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  optionTitle: {
    fontSize: 16,
    color: T.text,
  },
  optionBody: {
    fontSize: 13,
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
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: T.accent,
  },
  actionText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
