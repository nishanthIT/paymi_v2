import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompositionView } from '@/features/labels/components/composition-view';
import { LabelField } from '@/features/labels/components/label-field';
import { EditorMenu } from '@/features/labels/components/labels-menu';
import { LabelsScreen } from '@/features/labels/components/labels-screen';
import { GeneratePdfButton } from '@/features/labels/components/mixed-parts';
import { PrinterInfoSheet } from '@/features/labels/components/printer-info';
import { CheckRow } from '@/features/labels/components/sticker-editor-parts';
import { useLabelOutput } from '@/features/labels/components/label-output';
import { useLabelDraft } from '@/features/labels/hooks/use-label-draft';
import { useLabelLibrary } from '@/features/labels/hooks/use-label-library';
import { draftSummary } from '@/features/labels/render/draft-preview';
import {
  composeRunnerPages,
  readRunnerSettings,
  renderRunner,
  RUNNER_BOUNDS,
  RUNNER_COLOURS,
  RUNNER_PRESETS,
  runnerStripsPerPage,
  validateRunnerSize,
  type RunnerBackground,
  type RunnerSettings,
} from '@/features/labels/render/shelf-runner';
import { LabelTokens as T } from '@/features/labels/tokens';

/** Shelf liner / runner editor (inferred — not in the references): message only, no product. */
export default function ShelfRunnerScreen() {
  const insets = useSafeAreaInsets();
  const labels = useLabelDraft('RUNNER');
  const library = useLabelLibrary({ load: false });
  const { setSettings } = labels;
  const s = readRunnerSettings(labels.draft.settings);
  const set = useCallback((patch: Partial<RunnerSettings>) => setSettings(patch), [setSettings]);

  const [customW, setCustomW] = useState<string | null>(null);
  const [customH, setCustomH] = useState<string | null>(null);
  const [previewW, setPreviewW] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const output = useLabelOutput();
  const [errors, setErrors] = useState<string[] | null>(null);

  const strip = renderRunner(s);
  const scale = previewW > 0 ? previewW / s.widthMm : 0;
  const perPage = runnerStripsPerPage(s.heightMm);
  const pages = Math.ceil(s.copies / perPage);
  const custom = s.presetId === 'custom';
  const wText = customW ?? String(s.widthMm);
  const hText = customH ?? String(s.heightMm);
  const sizeError = custom ? validateRunnerSize(Number(wText), Number(hText)) : null;

  const applyCustom = (w: string, h: string) => {
    if (!validateRunnerSize(Number(w), Number(h))) set({ presetId: 'custom', widthMm: Number(w), heightMm: Number(h) });
  };

  const generate = () => {
    if (output.busy) return;
    const issues = [...strip.warnings, ...(sizeError ? [sizeError] : [])];
    if (issues.length) return setErrors(issues);
    setErrors(null);
    const out = composeRunnerPages(strip, s.copies);
    const draft = labels.draft;
    output.start({ title: 'Shelf liner', pages: out }, (outcome) => {
      if (outcome === 'cancelled') return;
      library
        .recordJob({ toolId: 'RUNNER', title: 'Shelf liner', summary: draftSummary(draft).summary, output: 'sheet', pages: out, copies: 1, outcome, draft })
        .catch(() => {});
    });
  };

  return (
    <LabelsScreen
      title="Shelf liner"
      right={<EditorMenu labels={labels} extra={[{ key: 'help', icon: 'printer-outline', label: 'Printing & PDF help', onPress: () => setHelpOpen(true) }]} />}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.previewSurround} onLayout={(e) => setPreviewW(e.nativeEvent.layout.width - 32)}>
          {scale > 0 && (
            <View style={styles.previewStrip}>
              <CompositionView composition={strip} scale={scale} />
            </View>
          )}
        </View>
        <Text style={styles.sizeNote}>
          Actual size {s.widthMm} × {s.heightMm} mm
        </Text>

        <Text style={styles.heading}>Message</Text>
        <LabelField
          label="Headline"
          value={s.headline}
          onChangeText={(headline) => set({ headline })}
          placeholder="e.g. SALE"
          autoCapitalize="characters"
          maxLength={24}
        />
        <LabelField
          label="Supporting text"
          value={s.support}
          onChangeText={(support) => set({ support })}
          placeholder="e.g. UP TO 50% OFF"
          helper="Optional · a percentage, date or short offer"
          autoCapitalize="characters"
          maxLength={40}
        />

        <Text style={styles.heading}>Colour</Text>
        <View style={styles.chips}>
          {(Object.keys(RUNNER_COLOURS) as RunnerBackground[]).map((key) => {
            const c = RUNNER_COLOURS[key];
            const selected = key === s.background;
            return (
              <Pressable
                key={key}
                onPress={() => set({ background: key })}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[styles.swatch, { backgroundColor: c.fill }]}>
                  <Text style={[styles.swatchText, { color: c.ink }]}>A</Text>
                </View>
                <Text style={styles.chipText}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <CheckRow
          title="Repeat along the strip"
          helper="Prints the message several times so it reads from anywhere in the aisle"
          value={s.repeat}
          onChange={(repeat) => set({ repeat })}
        />

        <Text style={styles.heading}>Strip size</Text>
        <View style={styles.card}>
          {[...RUNNER_PRESETS, { id: 'custom', label: 'Custom size', widthMm: s.widthMm, heightMm: s.heightMm }].map((p) => {
            const selected = p.id === s.presetId;
            return (
              <Pressable
                key={p.id}
                onPress={() => (p.id === 'custom' ? set({ presetId: 'custom' }) : set({ presetId: p.id, widthMm: p.widthMm, heightMm: p.heightMm }))}
                style={styles.option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? T.accent : T.textLight} />
                <Text style={styles.optionText}>{p.label}</Text>
              </Pressable>
            );
          })}
          {custom && (
            <View style={styles.customRow}>
              <View style={styles.flex}>
                <LabelField
                  label="Length (mm)"
                  value={wText}
                  keyboardType="decimal-pad"
                  onChangeText={(v) => {
                    setCustomW(v);
                    applyCustom(v, hText);
                  }}
                />
              </View>
              <View style={styles.flex}>
                <LabelField
                  label="Height (mm)"
                  value={hText}
                  keyboardType="decimal-pad"
                  onChangeText={(v) => {
                    setCustomH(v);
                    applyCustom(wText, v);
                  }}
                />
              </View>
            </View>
          )}
          <Text style={[styles.helper, sizeError && styles.helperError]}>
            {sizeError ??
              `Prints true-size on A4 landscape · ${RUNNER_BOUNDS.minW}–${RUNNER_BOUNDS.maxW} mm long, ${RUNNER_BOUNDS.minH}–${RUNNER_BOUNDS.maxH} mm high. Join strips for longer shelves.`}
          </Text>
        </View>

        <View style={[styles.card, styles.copiesRow]}>
          <View style={styles.flex}>
            <Text style={styles.optionText}>Copies</Text>
            <Text style={styles.helper}>
              {perPage} per A4 sheet · {pages} {pages === 1 ? 'page' : 'pages'}
            </Text>
          </View>
          <Pressable
            onPress={() => set({ copies: Math.max(1, s.copies - 1) })}
            disabled={s.copies <= 1}
            style={styles.stepper}
            accessibilityRole="button"
            accessibilityLabel="Fewer copies"
          >
            <Ionicons name="remove" size={20} color={s.copies <= 1 ? T.textLight : T.text} />
          </Pressable>
          <Text style={styles.copies}>{s.copies}</Text>
          <Pressable onPress={() => set({ copies: Math.min(99, s.copies + 1) })} style={styles.stepper} accessibilityRole="button" accessibilityLabel="More copies">
            <Ionicons name="add" size={20} color={T.text} />
          </Pressable>
        </View>

        {errors && (
          <View style={styles.issues}>
            {errors.map((e) => (
              <Text key={e} style={styles.issueText}>
                {e}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) + 16 }]}>
        <GeneratePdfButton busy={output.busy} onPress={generate} />
      </View>
      {output.sheet}
      <PrinterInfoSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </LabelsScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: T.insetPage,
    paddingBottom: 32,
    gap: 12,
  },
  previewSurround: {
    backgroundColor: T.previewBg,
    borderRadius: T.radiusCard,
    padding: 16,
    alignItems: 'center',
  },
  previewStrip: {
    borderWidth: 1,
    borderColor: T.labelOutline,
    backgroundColor: T.surface,
  },
  sizeNote: {
    fontSize: 12.5,
    color: T.textSecondary,
    textAlign: 'center',
    marginTop: -4,
  },
  heading: {
    fontSize: 17.5,
    fontWeight: '500',
    color: T.text,
    marginTop: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingLeft: 7,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  chipSelected: {
    borderColor: T.accent,
    borderWidth: 2,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 13,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: T.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchText: {
    fontSize: 13,
    fontWeight: '800',
  },
  chipText: {
    fontSize: 15,
    color: T.text,
  },
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    gap: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  optionText: {
    fontSize: 15.5,
    color: T.text,
  },
  customRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  helper: {
    fontSize: 12.5,
    lineHeight: 17,
    color: T.textSecondary,
    marginTop: 4,
  },
  helperError: {
    color: T.error,
  },
  copiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copies: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 16,
    color: T.text,
  },
  issues: {
    backgroundColor: T.errorSoft,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  issueText: {
    fontSize: 13.5,
    color: T.error,
  },
  bottomBar: {
    paddingHorizontal: T.insetList + 2,
    paddingTop: 10,
    backgroundColor: T.bg,
  },
});
