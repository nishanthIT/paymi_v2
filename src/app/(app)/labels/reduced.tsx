import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HandheldScanCapture } from '@/features/labels/components/handheld-scan-capture';
import { LabelField } from '@/features/labels/components/label-field';
import { LabelsScreen } from '@/features/labels/components/labels-screen';
import { EditorMenu } from '@/features/labels/components/labels-menu';
import { ProductSearchSheet } from '@/features/labels/components/product-search-sheet';
import { ScanSearchButtons } from '@/features/labels/components/scan-search-buttons';
import {
  BackgroundChips,
  CheckRow,
  CurrencySheet,
  DesignCarousel,
  LabelSizeSheet,
  PrintButton,
  PrinterHelpSheet,
  PrinterSetupSheet,
  PrinterStatusCard,
  SizeCard,
  StickerPreview,
  TextColourChips,
} from '@/features/labels/components/sticker-editor-parts';
import { useLabelOutput } from '@/features/labels/components/label-output';
import { useLabelDraft } from '@/features/labels/hooks/use-label-draft';
import { useLabelLibrary } from '@/features/labels/hooks/use-label-library';
import { draftSummary } from '@/features/labels/render/draft-preview';
import { inferCustomCode } from '@/features/labels/model/barcode';
import { setPriceText } from '@/features/labels/model/label-item';
import { renderSticker } from '@/features/labels/render/reduced-sticker';
import { formatJobDate } from '@/features/labels/render/shelf-settings';
import {
  itemToStickerContent,
  readStickerSettings,
  sizeTitle,
  validateSticker,
  type StickerSettings,
} from '@/features/labels/render/sticker-settings';
import { subscribeLabelScan } from '@/features/labels/scan-bridge';
import { LabelTokens as T } from '@/features/labels/tokens';

/** Reduced sticker editor (R13–R16) with the Label size modal (R15). */
export default function ReducedStickerScreen() {
  const router = useRouter();
  const labels = useLabelDraft('REDUCED_STICKER');
  const library = useLabelLibrary({ load: false });
  const { addScan, addCustom, addFromSearch, removeItem, updateItem, setSettings: saveSettings } = labels;
  const settings = readStickerSettings(labels.draft.settings);
  const item = labels.draft.items[0];

  const [sizeOpen, setSizeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const output = useLabelOutput();
  const [copiesText, setCopiesText] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [today] = useState(() => formatJobDate(new Date()));

  const setSetting = useCallback(
    <K extends keyof StickerSettings>(key: K, value: StickerSettings[K]) => saveSettings({ [key]: value }),
    [saveSettings],
  );

  // A single sticker is one draft item; create it lazily so fields always have a home.
  useEffect(() => {
    if (labels.hydrated && labels.draft.items.length === 0) addCustom();
  }, [labels.hydrated, labels.draft.items.length, addCustom]);

  /** One sticker at a time: a new scan/search replaces the current product. */
  const replaceWithScan = useCallback(
    (barcode: string) => {
      labels.draft.items.forEach((i) => removeItem(i.id));
      addScan(barcode);
      setCopiesText(null);
      setTouched({});
    },
    [labels.draft.items, removeItem, addScan],
  );

  useEffect(() => subscribeLabelScan(replaceWithScan), [replaceWithScan]);

  const update = (fn: Parameters<typeof updateItem>[1]) => item && updateItem(item.id, fn);

  const renderOptions = {
    widthMm: settings.widthMm,
    heightMm: settings.heightMm,
    background: settings.background,
    textColour: settings.textColour,
    dateText: settings.printDate ? today : undefined,
  };
  const content = itemToStickerContent(item, settings.title);
  const composition = renderSticker(settings.design, content, renderOptions);
  const errors = validateSticker(item);
  const copiesInvalid = copiesText !== null && !/^[1-9]\d{0,2}$/.test(copiesText);
  const canPrint =
    !!item && item.lookup !== 'looking_up' && Object.keys(errors).length === 0 && !copiesInvalid && composition.warnings.length === 0;

  const printHelper = !item || errors.price
    ? 'Add a price to print.'
    : copiesInvalid
      ? 'Copies must be a whole number, 1 or more.'
      : composition.warnings[0] ?? errors.barcode ?? errors.was ?? 'No label printer yet — you’ll get a PDF to print.';

  const handlePdf = () => {
    if (!item || !canPrint || output.busy) return;
    // One date captured for this job, so preview and output agree.
    const jobDate = settings.printDate ? formatJobDate(new Date()) : undefined;
    const job = renderSticker(settings.design, content, { ...renderOptions, dateText: jobDate });
    const draft = labels.draft;
    setSetupOpen(false);
    output.start({ title: 'Reduced sticker', pages: Array.from({ length: item.copies }, () => job) }, (outcome) => {
      if (outcome === 'cancelled') return;
      library
        .recordJob({
          toolId: 'REDUCED_STICKER',
          title: 'Reduced sticker',
          summary: draftSummary(draft).summary,
          output: 'roll',
          pages: [job],
          copies: item.copies,
          outcome,
          draft,
        })
        .catch(() => {});
    });
  };

  const barcodeError = touched.barcode ? errors.barcode : undefined;
  const priceError = touched.price && errors.price && item?.priceText.trim() ? errors.price : undefined;
  const wasError = touched.was ? errors.was : undefined;

  return (
    <LabelsScreen
      title="Reduced sticker"
      right={
        <EditorMenu
          labels={labels}
          extra={[{ key: 'help', icon: 'help-circle-outline', label: 'Which sticker printers work?', onPress: () => setHelpOpen(true) }]}
        />
      }
    >
      <HandheldScanCapture
        active={labels.hydrated && !sizeOpen && !searchOpen && !currencyOpen && !setupOpen && !helpOpen}
        onBarcode={replaceWithScan}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SizeCard
          widthMm={settings.widthMm}
          heightMm={settings.heightMm}
          dpi={settings.printerDpi}
          onPress={() => setSizeOpen(true)}
        />

        <Text style={styles.heading}>Design</Text>
        <DesignCarousel
          value={settings.design}
          onChange={(design) => setSetting('design', design)}
          options={{ background: settings.background, textColour: settings.textColour }}
        />

        <Text style={styles.heading}>Background</Text>
        <BackgroundChips value={settings.background} onChange={(v) => setSetting('background', v)} />

        <Text style={styles.heading}>Text colour</Text>
        <TextColourChips value={settings.textColour} onChange={(v) => setSetting('textColour', v)} />

        <Text style={styles.heading}>Sticker</Text>
        <ScanSearchButtons
          onScan={() => router.push({ pathname: '/(app)/scanner', params: { intent: 'label' } })}
          onSearch={() => setSearchOpen(true)}
        />
        {item?.lookup === 'looking_up' && (
          <Text style={styles.status}>Looking up {item.snapshot.barcode}…</Text>
        )}
        {item?.lookup === 'found' && !!item.snapshot.displayName && (
          <Text style={styles.status} numberOfLines={2}>
            {item.snapshot.displayName}
            {item.snapshot.sourceRrpMinor == null ? ' · no RRP in the catalogue — enter your price' : ''}
          </Text>
        )}
        {item?.lookup === 'not_found' && (
          <Text style={styles.status}>{item.snapshot.barcode} isn’t in the catalogue — enter the price yourself.</Text>
        )}
        {item?.lookup === 'error' && (
          <Text style={[styles.status, styles.statusError]} onPress={() => labels.retryLookup(item.id)}>
            {item.lookupError ?? 'Lookup failed'} — tap to retry
          </Text>
        )}

        <View style={styles.fields}>
          <LabelField
            label="Title"
            value={settings.title}
            onChangeText={(title) => setSetting('title', title)}
            helper="REDUCED, CLEARANCE, anything you like"
            autoCapitalize="characters"
            inlineWhenEmpty
          />
          <LabelField
            label="Barcode"
            value={item?.snapshot.barcode ?? ''}
            onChangeText={(text) => {
              const barcode = text.trim();
              update((i) => ({
                ...i,
                snapshot: { ...i.snapshot, barcode, customCode: inferCustomCode(barcode), barcodeSymbology: undefined },
              }));
            }}
            onBlur={() => setTouched((t) => ({ ...t, barcode: true }))}
            error={barcodeError}
            helper="Optional · EAN-13, UPC-A, EAN-8 or your own code"
            autoCapitalize="characters"
            autoCorrect={false}
            inlineWhenEmpty
          />
          <View style={styles.pair}>
            <View style={styles.flex}>
              <LabelField
                label="Price"
                value={item?.priceText ?? ''}
                onChangeText={(text) => update((i) => setPriceText(i, text))}
                onBlur={() => setTouched((t) => ({ ...t, price: true }))}
                error={priceError}
                keyboardType="decimal-pad"
                inlineWhenEmpty
              />
            </View>
            <View style={styles.flex}>
              <LabelField
                label="Was price"
                value={item?.wasText ?? ''}
                onChangeText={(wasText) => update((i) => ({ ...i, wasText }))}
                onBlur={() => setTouched((t) => ({ ...t, was: true }))}
                error={wasError}
                helper="Optional"
                keyboardType="decimal-pad"
                inlineWhenEmpty
              />
            </View>
          </View>
          <View style={styles.pair}>
            <Pressable style={styles.flex} onPress={() => setCurrencyOpen(true)} accessibilityRole="button" accessibilityLabel="Currency GBP">
              <View pointerEvents="none">
                <LabelField
                  label="Currency"
                  value="GBP  £"
                  editable={false}
                  right={<Ionicons name="caret-down" size={16} color={T.textSecondary} />}
                />
              </View>
            </Pressable>
            <View style={styles.flex}>
              <LabelField
                label="Copies"
                value={copiesText ?? String(item?.copies ?? 1)}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, '').slice(0, 3);
                  setCopiesText(cleaned);
                  if (/^[1-9]\d{0,2}$/.test(cleaned)) update((i) => ({ ...i, copies: Number(cleaned) }));
                }}
                error={copiesInvalid ? 'Whole number, 1 or more' : undefined}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        <CheckRow
          title="Print the date"
          helper="Today's date, small at the foot of the label"
          value={settings.printDate}
          onChange={(v) => setSetting('printDate', v)}
        />

        <Text style={styles.heading}>Preview</Text>
        <StickerPreview composition={composition} />

        <PrinterStatusCard onSetUp={() => setSetupOpen(true)} />
        <PrintButton enabled={canPrint} busy={output.busy} onPress={() => setSetupOpen(true)} />
        <Text style={styles.printHelper}>{printHelper}</Text>
        <Pressable onPress={() => setHelpOpen(true)} style={styles.helpRow} accessibilityRole="button">
          <Ionicons name="information-circle-outline" size={20} color={T.textSecondary} />
          <Text style={styles.helpText}>Which sticker printers work?</Text>
        </Pressable>
      </ScrollView>

      <LabelSizeSheet
        visible={sizeOpen}
        selectedId={settings.sizeId}
        widthMm={settings.widthMm}
        heightMm={settings.heightMm}
        dpi={settings.printerDpi}
        onPick={(size) => saveSettings({ sizeId: size.id, widthMm: size.widthMm, heightMm: size.heightMm })}
        onClose={() => setSizeOpen(false)}
      />
      <ProductSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={(result) => {
          labels.draft.items.forEach((i) => removeItem(i.id));
          addFromSearch(result);
          setCopiesText(null);
        }}
        onBarcode={replaceWithScan}
        onScan={() => {
          setSearchOpen(false);
          router.push({ pathname: '/(app)/scanner', params: { intent: 'label' } });
        }}
        onAddCustom={() => {
          labels.draft.items.forEach((i) => removeItem(i.id));
          addCustom();
          setCopiesText(null);
        }}
      />
      <CurrencySheet visible={currencyOpen} onClose={() => setCurrencyOpen(false)} />
      <PrinterSetupSheet
        visible={setupOpen}
        sizeText={sizeTitle(settings.widthMm, settings.heightMm)}
        canPrint={canPrint}
        busy={output.busy}
        onPdf={handlePdf}
        onClose={() => setSetupOpen(false)}
      />
      <PrinterHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
      {output.sheet}
    </LabelsScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: T.insetPage,
    paddingBottom: 56,
    gap: 14,
  },
  heading: {
    fontSize: 17.5,
    fontWeight: '500',
    color: T.text,
    marginTop: 8,
  },
  flex: {
    flex: 1,
  },
  fields: {
    gap: 16,
    marginTop: 6,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  status: {
    fontSize: 13.5,
    color: T.textSecondary,
  },
  statusError: {
    color: T.error,
  },
  printHelper: {
    fontSize: 13.5,
    color: T.textSecondary,
    textAlign: 'center',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  helpText: {
    fontSize: 14.5,
    color: T.text,
  },
});
