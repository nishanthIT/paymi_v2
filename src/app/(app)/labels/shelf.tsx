import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { HandheldScanCapture } from '@/features/labels/components/handheld-scan-capture';
import { LabelsScreen } from '@/features/labels/components/labels-screen';
import { EditorMenu } from '@/features/labels/components/labels-menu';
import { ProductEditorSheet } from '@/features/labels/components/product-editor-sheet';
import {
  ProductRow,
  ProductsEmptyState,
  ProductsHeading,
} from '@/features/labels/components/product-rows';
import { ProductSearchSheet } from '@/features/labels/components/product-search-sheet';
import { ScanSearchButtons } from '@/features/labels/components/scan-search-buttons';
import { SheetPreview } from '@/features/labels/components/sheet-preview';
import {
  DesignPicker,
  OptionsCard,
  RaisedPenceExample,
  SectionHeading,
  SheetCard,
  SheetSettingsCard,
  type OptionRowSpec,
} from '@/features/labels/components/shelf-editor-parts';
import { ChangeSheetSheet, StartAtSheet } from '@/features/labels/components/start-at-sheet';
import { useLabelDraft } from '@/features/labels/hooks/use-label-draft';
import { useLabelLibrary } from '@/features/labels/hooks/use-label-library';
import { PrintAction, useLabelOutput } from '@/features/labels/components/label-output';
import { draftSummary } from '@/features/labels/render/draft-preview';
import { itemPrintIssues } from '@/features/labels/render/print-checks';
import { composeGridPages, nextStartCell } from '@/features/labels/render/print-jobs';
import { labelInstanceCount } from '@/features/labels/model/draft';
import type { LabelItem } from '@/features/labels/model/label-item';
import { STANDARD_SHELF_SHEET } from '@/features/labels/registry/sizes';
import { expandInstances, paginate } from '@/features/labels/render/sheet-layout';
import {
  FIXTURE_PROMO,
  FIXTURE_STANDARD,
  renderShelfLabel,
  type ShelfDesign,
  type ShelfLabelOptions,
} from '@/features/labels/render/shelf-label';
import {
  formatJobDate,
  itemToShelfContent,
  readShelfSettings,
  type ShelfMode,
  type ShelfSettings,
} from '@/features/labels/render/shelf-settings';
import { subscribeLabelScan } from '@/features/labels/scan-bridge';
import { LabelTokens as T } from '@/features/labels/tokens';

const DESIGNS: Record<ShelfMode, { value: ShelfDesign; label: string }[]> = {
  standard: [
    { value: 'standard', label: 'Standard' },
    { value: 'tobacco', label: 'Tobacco' },
  ],
  promo: [
    { value: 'full_yellow', label: 'Full yellow' },
    { value: 'half_yellow', label: 'Half yellow' },
  ],
};

const SHEET = STANDARD_SHELF_SHEET;

function isBlankCustom(item: LabelItem) {
  return (
    !item.snapshot.catalogueProductId &&
    !item.snapshot.displayName.trim() &&
    !item.snapshot.barcode.trim() &&
    !item.priceText.trim()
  );
}

/** Shelf labels editor — Standard (R19–R21) and Promo (R17–R18) modes. */
export default function ShelfLabelsScreen() {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode: ShelfMode = modeParam === 'promo' ? 'promo' : 'standard';
  const toolId = mode === 'promo' ? 'SEL_PROMO' : 'SEL_STANDARD';
  const router = useRouter();
  const labels = useLabelDraft(toolId);
  const { addScan, setSettings: saveSettings } = labels;

  const [searchOpen, setSearchOpen] = useState(false);
  const [startAtOpen, setStartAtOpen] = useState(false);
  const [sheetPickerOpen, setSheetPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = labels.draft.items.find((i) => i.id === editingId) ?? null;
  // One date per preview; a print captures a fresh job date and the preview follows it.
  const [today, setToday] = useState(() => formatJobDate(new Date()));
  const output = useLabelOutput();
  const library = useLabelLibrary({ load: false });
  const [printErrors, setPrintErrors] = useState<string[] | null>(null);
  const [nextStart, setNextStart] = useState<number | null>(null);

  const settings = readShelfSettings(mode, labels.draft.settings);
  const setSetting = useCallback(
    <K extends keyof ShelfSettings>(key: K, value: ShelfSettings[K]) => saveSettings({ [key]: value }),
    [saveSettings],
  );

  useEffect(() => subscribeLabelScan((barcode) => addScan(barcode)), [addScan]);

  const openCamera = () => {
    setSearchOpen(false);
    router.push({ pathname: '/(app)/scanner', params: { intent: 'label' } });
  };

  const closeEditor = () => {
    if (editing && isBlankCustom(editing)) labels.removeItem(editing.id);
    setEditingId(null);
  };

  const count = labelInstanceCount(labels.draft);
  const hasItems = labels.draft.items.length > 0;

  const renderOptions: ShelfLabelOptions = {
    penceSameSize: settings.penceSameSize,
    dateText: settings.printDate ? today : undefined,
    priceOnRight: settings.priceOnRight,
    barcodeDownSide: settings.barcodeDownSide,
    widthRatio: settings.widthRatio,
    colouredStock: settings.colouredStock,
  };

  const compositions = new Map<string, ReturnType<typeof renderShelfLabel>>();
  for (const item of labels.draft.items) {
    if (item.lookup === 'looking_up') continue;
    compositions.set(item.id, renderShelfLabel(settings.design, itemToShelfContent(item), renderOptions));
  }

  const pages = paginate(expandInstances(labels.draft.items), settings.startAt, SHEET);

  // Sample artwork only when there are no products; it is never part of output.
  const fixture = !hasItems
    ? {
        cell: settings.startAt,
        composition: renderShelfLabel(
          settings.design,
          mode === 'promo' ? FIXTURE_PROMO : FIXTURE_STANDARD,
          renderOptions,
        ),
      }
    : undefined;

  const problems = labels.draft.items.filter(
    (item) => (compositions.get(item.id)?.warnings.length ?? 0) > 0,
  );

  const printSheet = () => {
    if (output.busy) return;
    const items = labels.draft.items;
    if (!items.length) return setPrintErrors(['Add products first — the sample label never prints.']);
    const jobDate = settings.printDate ? formatJobDate(new Date()) : undefined;
    if (jobDate && jobDate !== today) setToday(jobDate);
    const options = { ...renderOptions, dateText: jobDate };
    const job = new Map(items.map((item) => [item.id, renderShelfLabel(settings.design, itemToShelfContent(item), options)]));
    const issues = items.flatMap((item) =>
      itemPrintIssues(item, job.get(item.id)!).map((m) => `${item.snapshot.displayName || item.snapshot.barcode || 'Untitled product'}: ${m}`),
    );
    if (issues.length) return setPrintErrors(issues);
    setPrintErrors(null);
    const sheetPages = paginate(expandInstances(items), settings.startAt, SHEET);
    const out = composeGridPages(sheetPages, (id) => job.get(id) ?? null, SHEET);
    const draft = labels.draft;
    const title = mode === 'promo' ? 'Shelf labels · Promo' : 'Shelf labels · Standard';
    output.start({ title, pages: out }, (outcome) => {
      if (outcome === 'cancelled') return;
      // Only the owner can confirm the labels were used; offer, never assume.
      setNextStart(nextStartCell(sheetPages, SHEET));
      library
        .recordJob({ toolId, title, summary: draftSummary(draft).summary, output: 'sheet', pages: out, copies: 1, outcome, draft })
        .catch(() => {});
    });
  };

  const optionRows: OptionRowSpec[] = [
    {
      key: 'pence',
      title: 'Pence the same size',
      helper: (
        <>
          Prints £1.95 flat. Off, the pence are raised small — <RaisedPenceExample /> — so the pounds carry
          down the aisle
        </>
      ),
      value: settings.penceSameSize,
      onChange: (v) => setSetting('penceSameSize', v),
    },
    {
      key: 'date',
      title: 'Print the date',
      helper: "Today's date, small at the foot of every label",
      value: settings.printDate,
      onChange: (v) => setSetting('printDate', v),
    },
    ...(mode === 'standard'
      ? [
          {
            key: 'priceRight',
            title: 'Price on the right',
            helper: 'Barcode on the left. Turn off to swap them over on the standard design',
            value: settings.priceOnRight,
            onChange: (v: boolean) => setSetting('priceOnRight', v),
          },
          {
            key: 'barcodeSide',
            title: 'Barcode down the side',
            helper:
              'Turns it upright in its own column on the standard design, which makes the bars longer',
            value: settings.barcodeDownSide,
            onChange: (v: boolean) => setSetting('barcodeDownSide', v),
          },
        ]
      : [
          {
            key: 'stock',
            title: 'Printing on yellow labels',
            helper: 'Leave the yellow unprinted — the preview shows your stock colour',
            value: settings.colouredStock,
            onChange: (v: boolean) => setSetting('colouredStock', v),
          },
        ]),
  ];

  return (
    <LabelsScreen title="Shelf labels" right={<EditorMenu labels={labels} />}>
      <HandheldScanCapture
        active={labels.hydrated && !searchOpen && !editing && !startAtOpen && !sheetPickerOpen}
        onBarcode={addScan}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SheetCard title={SHEET.title} subtitle={SHEET.subtitle} onChange={() => setSheetPickerOpen(true)} />

        <SectionHeading title="Design" />
        <DesignPicker
          designs={DESIGNS[mode]}
          value={settings.design}
          onChange={(design) => setSetting('design', design)}
          fixture={mode === 'promo' ? FIXTURE_PROMO : FIXTURE_STANDARD}
          optionsForThumb={{ ...renderOptions, dateText: undefined, widthRatio: 1 }}
        />

        <View style={styles.productsHeading}>
          <ProductsHeading count={count} />
        </View>
        {hasItems ? (
          <View style={styles.rows}>
            {labels.draft.items.map((item) => (
              <ProductRow
                key={item.id}
                item={item}
                onPress={() => setEditingId(item.id)}
                onRemove={() => labels.removeItem(item.id)}
                onCopies={(copies) => labels.updateItem(item.id, (i) => ({ ...i, copies }))}
              />
            ))}
            <View style={styles.moreButtons}>
              <ScanSearchButtons onScan={openCamera} onSearch={() => setSearchOpen(true)} />
            </View>
          </View>
        ) : (
          <ProductsEmptyState onScan={openCamera} onSearch={() => setSearchOpen(true)} />
        )}

        <View style={styles.optionsGap}>
          <OptionsCard rows={optionRows} />
        </View>

        <SectionHeading title="Preview" />
        <SheetPreview
          sheet={SHEET}
          pages={pages}
          compositionFor={(id) => compositions.get(id) ?? null}
          fixture={fixture}
        />
        {!hasItems && (
          <Text style={styles.sampleNote}>Sample label — your products print here once you add them.</Text>
        )}
        {problems.length > 0 && (
          <View style={styles.problems}>
            {problems.map((item) => (
              <Text key={item.id} style={styles.problemText} onPress={() => setEditingId(item.id)}>
                {item.snapshot.displayName || item.snapshot.barcode}: {compositions.get(item.id)!.warnings[0]}
              </Text>
            ))}
          </View>
        )}

        <SheetSettingsCard
          startAt={settings.startAt}
          onStartAt={() => setStartAtOpen(true)}
          widthRatio={settings.widthRatio}
          onWidth={(value) => setSetting('widthRatio', value)}
        />

        {printErrors && (
          <View style={styles.problems}>
            {printErrors.map((e) => (
              <Text key={e} style={styles.problemText}>
                {e}
              </Text>
            ))}
          </View>
        )}
        <PrintAction label={count ? `Print ${count} ${count === 1 ? 'label' : 'labels'}` : 'Print labels'} busy={output.busy} onPress={printSheet} />
        {nextStart != null && (
          <View style={styles.nextStart}>
            <Text style={styles.nextStartText}>
              Used those labels? Next time start at label {nextStart}
              {nextStart === 1 ? ' on a fresh sheet' : ''}.
            </Text>
            <View style={styles.nextStartActions}>
              <Text style={styles.link} onPress={() => setNextStart(null)}>
                Not now
              </Text>
              <Text
                style={styles.link}
                onPress={() => {
                  setSetting('startAt', nextStart);
                  setNextStart(null);
                }}
              >
                Start at {nextStart}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <ProductSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={(result) => labels.addFromSearch(result)}
        onBarcode={(barcode) => addScan(barcode)}
        onScan={openCamera}
        onAddCustom={() => setEditingId(labels.addCustom().id)}
      />

      <ProductEditorSheet
        item={editing}
        visible={!!editing}
        onUpdate={(update) => editing && labels.updateItem(editing.id, update)}
        onRetryLookup={() => editing && labels.retryLookup(editing.id)}
        onClose={closeEditor}
        onRemove={() => {
          if (editing) labels.removeItem(editing.id);
          setEditingId(null);
        }}
      />

      <StartAtSheet
        visible={startAtOpen}
        sheet={SHEET}
        value={settings.startAt}
        onApply={(cell) => setSetting('startAt', cell)}
        onClose={() => setStartAtOpen(false)}
      />
      <ChangeSheetSheet
        visible={sheetPickerOpen}
        options={[{ id: SHEET.id, title: SHEET.title, subtitle: SHEET.subtitle }]}
        selectedId={settings.sheetId}
        onPick={() => setSetting('sheetId', 'STANDARD_SHELF_21')}
        onClose={() => setSheetPickerOpen(false)}
      />
      {output.sheet}
    </LabelsScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: T.insetPage,
    paddingBottom: 48,
    gap: 14,
  },
  productsHeading: {
    marginTop: 10,
    marginBottom: -12,
  },
  rows: {
    gap: 10,
  },
  moreButtons: {
    marginTop: 6,
  },
  optionsGap: {
    marginTop: 12,
  },
  sampleNote: {
    fontSize: 13,
    color: T.textSecondary,
    textAlign: 'center',
    marginTop: -4,
  },
  problems: {
    backgroundColor: T.errorSoft,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  problemText: {
    fontSize: 13.5,
    color: T.error,
  },
  nextStart: {
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    gap: 10,
  },
  nextStartText: {
    fontSize: 14.5,
    lineHeight: 20,
    color: T.text,
  },
  nextStartActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
  },
  link: {
    fontSize: 15.5,
    color: T.accent,
  },
});
