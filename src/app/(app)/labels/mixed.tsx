import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui/toast';
import { LabelsScreen } from '@/features/labels/components/labels-screen';
import {
  GeneratePdfButton,
  LayoutRow,
  LayoutSummaryCard,
  MixedPreview,
  PrintSheetCard,
  RefreshPreviewButton,
  SizePickerSheet,
  SlotRow,
  type FilledSlot,
} from '@/features/labels/components/mixed-parts';
import { MixedSlotEditor } from '@/features/labels/components/mixed-slot-editor';
import { ChangeSheetSheet } from '@/features/labels/components/start-at-sheet';
import { useLabelOutput } from '@/features/labels/components/label-output';
import { useLabelDraft } from '@/features/labels/hooks/use-label-draft';
import { useLabelLibrary } from '@/features/labels/hooks/use-label-library';
import { draftSummary } from '@/features/labels/render/draft-preview';
import type { LabelItem } from '@/features/labels/model/label-item';
import {
  addEntry,
  cellSizes,
  changeLayout,
  compatibleEmptyCells,
  compatibleTemplates,
  isBlankEntry,
  isCustomLayout,
  moveEntry,
  newEntry,
  newEntryId,
  placeInCell,
  readMixedState,
  removeEntry,
  unplacedEntries,
  updateEntry,
  type MixedEntry,
  type MixedState,
} from '@/features/labels/model/mixed';
import { parseMoneyText } from '@/features/labels/model/money';
import { MIXED_LAYOUTS, TEMPLATES } from '@/features/labels/registry/manifest';
import { CUSTOM_SIZES, DEFAULT_MIXED_SHEET, MIXED_SHEETS, SIZE_LABEL } from '@/features/labels/registry/mixed-geometry';
import { LABEL_SIZES, type LabelSizeId } from '@/features/labels/registry/sizes';
import { buildMixedJob, entryIssues, packCustom, renderEntry, type MixedJob } from '@/features/labels/render/mixed-sheet';
import { LabelTokens as T } from '@/features/labels/tokens';

const INTRO = 'Pick a sheet, then a layout. Each layout has cells of fixed sizes - fill them with any compatible template.';

/** Mixed sheet (R03/R02 chooser → R23/R01 editor → inferred slot editor), one draft for all three. */
export default function MixedSheetScreen() {
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const labels = useLabelDraft('MIXED');
  const library = useLabelLibrary({ load: false });
  const { removeItem, setSettings, addCustom, updateItem } = labels;
  const items = labels.draft.items;
  const state = readMixedState(labels.draft.settings);
  const custom = isCustomLayout(state.layoutId);
  const layout = MIXED_LAYOUTS.find((l) => l.id === state.layoutId);

  const [view, setView] = useState<'chooser' | 'editor'>('chooser');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [preview, setPreview] = useState<{ job: MixedJob; key: string } | null>(null);
  const [exportErrors, setExportErrors] = useState<string[] | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const output = useLabelOutput();
  /** Latest state, so two updates in one frame never build on a stale copy. */
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const commit = useCallback(
    (next: MixedState) => {
      stateRef.current = next;
      setSettings({ layoutId: next.layoutId, entries: next.entries, cells: next.cells });
      setExportErrors(null);
    },
    [setSettings],
  );

  // Items no label refers to any more (replaced/cleared products) are dropped.
  const usedIds = state.entries.map((e) => e.itemId ?? '').join('|');
  useEffect(() => {
    if (!labels.hydrated) return;
    const used = new Set(usedIds.split('|'));
    items.filter((i) => !used.has(i.id)).forEach((i) => removeItem(i.id));
  }, [labels.hydrated, usedIds, items, removeItem]);

  // A slot opened and left with nothing entered (e.g. app closed mid-edit) goes back to "Tap to fill".
  useEffect(() => {
    if (!labels.hydrated || editingId) return;
    const s = stateRef.current;
    const blanks = s.entries.filter(isBlankEntry);
    if (blanks.length) commit(blanks.reduce((acc, e) => removeEntry(acc, e.id), s));
  }, [labels.hydrated, editingId, commit]);

  useEffect(() => {
    if (view !== 'editor' || editingId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setView('chooser');
      return true;
    });
    return () => sub.remove();
  }, [view, editingId]);

  const itemOf = (e: MixedEntry) => items.find((i) => i.id === e.itemId);
  const currentKey = JSON.stringify([state, items]);

  const pickLayout = (layoutId: string) => {
    if (layoutId !== stateRef.current.layoutId) commit(changeLayout(stateRef.current, layoutId));
    setPreview(null);
    setView('editor');
  };

  const openCell = (index: number) => {
    const s = stateRef.current;
    const existing = s.cells[index];
    if (existing) return setEditingId(existing);
    const size = cellSizes(s.layoutId)[index];
    const entry = newEntry(size, compatibleTemplates(size)[0]?.id);
    commit(addEntry(s, entry, index));
    setEditingId(entry.id);
  };

  const addCustomLabel = (sizeId: LabelSizeId) => {
    const entry = newEntry(sizeId, compatibleTemplates(sizeId)[0]?.id);
    commit(addEntry(stateRef.current, entry));
    setEditingId(entry.id);
  };

  const cloneItem = (source: LabelItem | undefined) => {
    if (!source) return undefined;
    const copy = addCustom();
    updateItem(copy.id, () => ({
      ...source,
      id: copy.id,
      createdAt: copy.createdAt,
      lookup: source.lookup === 'looking_up' ? 'idle' : source.lookup,
    }));
    return copy.id;
  };

  const duplicate = (entry: MixedEntry, targetSlot?: number) => {
    const s = stateRef.current;
    const clone: MixedEntry = { ...entry, id: newEntryId(), itemId: cloneItem(itemOf(entry)) };
    if (custom) {
      const at = s.entries.findIndex((e) => e.id === entry.id) + 1;
      commit({ ...s, entries: [...s.entries.slice(0, at), clone, ...s.entries.slice(at)] });
      showToast('Label duplicated', 'success');
    } else if (targetSlot) {
      commit(addEntry(s, clone, targetSlot - 1));
      showToast(`Copied to slot ${targetSlot}`, 'success');
    }
  };

  const discard = (entry: MixedEntry) => {
    if (entry.itemId) removeItem(entry.itemId);
    commit(removeEntry(stateRef.current, entry.id));
  };

  const summary = (entry: MixedEntry): FilledSlot | undefined => {
    if (!entry.templateId && !entry.itemId) return undefined;
    const item = itemOf(entry);
    const c = renderEntry(entry, item);
    const template = TEMPLATES.find((t) => t.id === entry.templateId);
    const price = parseMoneyText(item?.priceText ?? '');
    return {
      title: item?.snapshot.displayName || (item ? 'Untitled product' : 'No product yet'),
      subtitle: [template?.title ?? 'Choose a design', price.kind === 'ok' && price.minor > 0 ? `£${(price.minor / 100).toFixed(2)}` : '']
        .filter(Boolean)
        .join(' · '),
      composition: c,
      issue: entryIssues(entry, item, c)[0],
    };
  };

  const refresh = () => setPreview({ job: buildMixedJob(stateRef.current, items), key: currentKey });

  const generatePdf = () => {
    if (output.busy) return;
    const job = buildMixedJob(stateRef.current, items);
    setPreview({ job, key: currentKey });
    if (job.filled === 0) {
      setExportErrors([custom ? 'Add at least one label before generating a PDF.' : 'Fill at least one slot before generating a PDF.']);
      return;
    }
    if (job.issues.length) {
      setExportErrors(job.issues.map((i) => `${custom ? 'Label' : 'Slot'} ${i.slot}: ${i.message}`));
      showToast('Fix the labels listed first', 'error');
      return;
    }
    setExportErrors(null);
    const draft = labels.draft;
    const title = `Mixed sheet · ${layout?.title ?? ''}`;
    output.start({ title, pages: job.pages }, (outcome) => {
      if (outcome === 'cancelled') return;
      library
        .recordJob({ toolId: 'MIXED', title, summary: draftSummary(draft).summary, output: 'sheet', pages: job.pages, copies: 1, outcome, draft })
        .catch(() => {});
    });
  };

  // ---------- Slot editor ----------
  const editing = editingId ? state.entries.find((e) => e.id === editingId) : undefined;
  if (view === 'editor' && editing) {
    const slotIndex = custom ? state.entries.indexOf(editing) : state.cells.indexOf(editing.id);
    const sizeLabel = SIZE_LABEL[editing.sizeId] ?? LABEL_SIZES[editing.sizeId].displayName;
    return (
      <MixedSlotEditor
        heading={slotIndex >= 0 ? `${custom ? 'Label' : 'Slot'} ${slotIndex + 1} · ${sizeLabel}` : sizeLabel}
        entry={editing}
        item={itemOf(editing)}
        labels={labels}
        onPatch={(patch) => commit(updateEntry(stateRef.current, editing.id, patch))}
        onDone={() => {
          const latest = stateRef.current.entries.find((e) => e.id === editing.id);
          if (latest && isBlankEntry(latest)) commit(removeEntry(stateRef.current, latest.id));
          setEditingId(null);
        }}
        onRemove={() => {
          discard(editing);
          setEditingId(null);
        }}
        duplicateTargets={custom ? [] : compatibleEmptyCells(state, editing.id).map((i) => i + 1)}
        onDuplicate={(target) => duplicate(editing, target)}
        showCopies={custom}
      />
    );
  }

  // ---------- Chooser (R03 + R02) ----------
  if (view === 'chooser' || !layout) {
    return (
      <LabelsScreen title="Mixed sheet">
        <ScrollView contentContainerStyle={styles.chooser}>
          <Text style={styles.intro}>{INTRO}</Text>
          <PrintSheetCard label={DEFAULT_MIXED_SHEET.label} onPress={() => setSheetOpen(true)} />
          <Text style={styles.layoutsHeading}>Layouts</Text>
          {MIXED_LAYOUTS.map((l) => (
            <LayoutRow key={l.id} layout={l} onPress={() => pickLayout(l.id)} />
          ))}
        </ScrollView>
        <ChangeSheetSheet
          visible={sheetOpen}
          title="Print sheet"
          body="Mixed layouts are set up for this sheet size."
          options={MIXED_SHEETS.map((s) => ({ id: s.id, title: s.label, subtitle: `${s.page.widthMm} × ${s.page.heightMm} mm` }))}
          selectedId={DEFAULT_MIXED_SHEET.id}
          onPick={() => {}}
          onClose={() => setSheetOpen(false)}
        />
      </LabelsScreen>
    );
  }

  // ---------- Editor (R23 / R01; Custom) ----------
  const unplaced = unplacedEntries(state);
  const sizes = cellSizes(state.layoutId);
  const customBlocks = state.entries.flatMap((e) =>
    Array.from({ length: Math.max(1, e.copies) }, (_, k) => ({
      key: `${e.id}#${k}`,
      wMm: LABEL_SIZES[e.sizeId].widthMm,
      hMm: LABEL_SIZES[e.sizeId].heightMm,
    })),
  );
  const customPages = custom ? packCustom(customBlocks).pages.length : 0;

  return (
    <LabelsScreen title="Mixed sheet" onBack={() => setView('chooser')}>
      <ScrollView contentContainerStyle={styles.editor}>
        <LayoutSummaryCard layout={layout} sheetLabel={DEFAULT_MIXED_SHEET.label} onChange={() => setView('chooser')} />

        {!custom &&
          sizes.map((size, i) => {
            const entry = state.entries.find((e) => e.id === state.cells[i]);
            return <SlotRow key={i} number={i + 1} sizeId={size} filled={entry && summary(entry)} onPress={() => openCell(i)} />;
          })}

        {custom && (
          <>
            {state.entries.map((entry, i) => (
              <SlotRow
                key={entry.id}
                number={i + 1}
                sizeId={entry.sizeId}
                filled={summary(entry)}
                onPress={() => setEditingId(entry.id)}
                trailing={
                  <View style={styles.reorder}>
                    <Pressable
                      onPress={() => commit(moveEntry(stateRef.current, entry.id, -1))}
                      disabled={i === 0}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Move up"
                    >
                      <Ionicons name="chevron-up" size={20} color={i === 0 ? T.borderStrong : T.text} />
                    </Pressable>
                    {entry.copies > 1 && <Text style={styles.copiesBadge}>×{entry.copies}</Text>}
                    <Pressable
                      onPress={() => commit(moveEntry(stateRef.current, entry.id, 1))}
                      disabled={i === state.entries.length - 1}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Move down"
                    >
                      <Ionicons name="chevron-down" size={20} color={i === state.entries.length - 1 ? T.borderStrong : T.text} />
                    </Pressable>
                  </View>
                }
              />
            ))}
            <Pressable
              onPress={() => setSizeOpen(true)}
              style={({ pressed }) => [styles.addLabel, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="add" size={22} color={T.accent} />
              <Text style={styles.addLabelText}>Add label</Text>
            </Pressable>
            {customBlocks.length > 0 && (
              <Text style={styles.hint}>
                {customBlocks.length} {customBlocks.length === 1 ? 'label' : 'labels'} · {customPages}{' '}
                {customPages === 1 ? 'page' : 'pages'} · printed at full size, arranged in the order above
              </Text>
            )}
          </>
        )}

        {unplaced.length > 0 && (
          <View style={styles.unplaced}>
            <Text style={styles.unplacedTitle}>Not on this layout</Text>
            <Text style={styles.hint}>
              Kept from your previous layout. Place each one in a free slot of the same size, or remove it.
            </Text>
            {unplaced.map((entry, k) => {
              const free = compatibleEmptyCells(state, entry.id);
              return (
                <View key={entry.id} style={styles.unplacedRow}>
                  <SlotRow number={k + 1} sizeId={entry.sizeId} filled={summary(entry)} onPress={() => setEditingId(entry.id)} />
                  <View style={styles.unplacedActions}>
                    {free.length > 0 ? (
                      <Pressable onPress={() => commit(placeInCell(stateRef.current, entry.id, free[0]))} accessibilityRole="button">
                        <Text style={styles.link}>Place in slot {free[0] + 1}</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.hint}>No free {SIZE_LABEL[entry.sizeId]} slot</Text>
                    )}
                    <Pressable
                      onPress={() => (confirmRemoveId === entry.id ? discard(entry) : setConfirmRemoveId(entry.id))}
                      accessibilityRole="button"
                    >
                      <Text style={styles.danger}>{confirmRemoveId === entry.id ? 'Tap again to remove' : 'Remove'}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <RefreshPreviewButton onPress={refresh} />

        {exportErrors && (
          <View style={styles.issues}>
            {exportErrors.map((e) => (
              <Text key={e} style={styles.issueText}>
                {e}
              </Text>
            ))}
          </View>
        )}
        {preview && <MixedPreview pages={preview.job.pages} stale={preview.key !== currentKey} />}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) + 30 }]}>
        <GeneratePdfButton busy={output.busy} onPress={generatePdf} />
      </View>
      {output.sheet}

      <SizePickerSheet visible={sizeOpen} sizes={CUSTOM_SIZES} onPick={addCustomLabel} onClose={() => setSizeOpen(false)} />
    </LabelsScreen>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  chooser: {
    paddingHorizontal: T.insetList,
    paddingTop: 14,
    paddingBottom: 48,
    gap: 9,
  },
  intro: {
    fontSize: 15,
    lineHeight: 17.5,
    color: T.textSecondary,
    marginHorizontal: 2,
    marginBottom: 6,
  },
  layoutsHeading: {
    fontSize: 16,
    fontWeight: '500',
    color: T.text,
    marginTop: 14,
    marginBottom: 6,
    marginLeft: 2,
  },
  editor: {
    paddingHorizontal: T.insetList,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 8,
  },
  reorder: {
    alignItems: 'center',
    gap: 2,
  },
  copiesBadge: {
    fontSize: 12,
    color: T.textSecondary,
  },
  addLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.accentBorder,
    backgroundColor: T.accentSoft,
  },
  addLabelText: {
    fontSize: 16.5,
    color: T.accent,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: T.textSecondary,
    marginHorizontal: 2,
  },
  unplaced: {
    gap: 8,
    marginTop: 8,
  },
  unplacedTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: T.text,
    marginLeft: 2,
  },
  unplacedRow: {
    gap: 6,
  },
  unplacedActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  link: {
    fontSize: 14.5,
    color: T.accent,
  },
  danger: {
    fontSize: 14.5,
    color: T.error,
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
