import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { BottomSheet } from '@/components/ui/bottom-sheet';

import type { LabelComposition } from '../renderer-contract';
import {
  renderSticker,
  STICKER_FIXTURE,
  type StickerBackground,
  type StickerDesign,
  type StickerOptions,
  type StickerTextColour,
} from '../render/reduced-sticker';
import {
  CUSTOM_BOUNDS,
  dotsText,
  sizeTitle,
  STICKER_PRESETS,
  validateCustomSize,
  type StickerSizePreset,
} from '../render/sticker-settings';
import { LabelTokens as T } from '../tokens';
import { CompositionView } from './composition-view';
import { LabelField } from './label-field';
import { CapabilityList } from './printer-info';

const CHIP_BG = T.surfaceAlt;
const C_DISABLED = Colors.light.buttonDisabled;
const C_DISABLED_TEXT = Colors.light.buttonDisabledText;

/** Size card (R16 top): ruler, bold size, dots subtitle, chevron. */
export function SizeCard({ widthMm, heightMm, dpi, onPress }: { widthMm: number; heightMm: number; dpi: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Label size ${sizeTitle(widthMm, heightMm)}`}
      style={({ pressed }) => [styles.card, styles.sizeCard, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name="ruler" size={26} color={T.text} />
      <View style={styles.flex}>
        <Text style={styles.sizeTitle}>{sizeTitle(widthMm, heightMm)}</Text>
        <Text style={styles.sizeSubtitle}>{dotsText(widthMm, heightMm, dpi)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={T.text} />
    </Pressable>
  );
}

/** Outline rectangle reflecting a preset's orientation. */
function SizeGlyph({ widthMm, heightMm }: { widthMm: number; heightMm: number }) {
  const scale = 34 / Math.max(widthMm, heightMm);
  return <View style={[styles.glyph, { width: widthMm * scale, height: heightMm * scale }]} />;
}

/** Label size modal (R15) with an inferred Custom size form. */
export function LabelSizeSheet({
  visible,
  selectedId,
  widthMm,
  heightMm,
  dpi,
  onPick,
  onClose,
}: {
  visible: boolean;
  selectedId: string;
  widthMm: number;
  heightMm: number;
  dpi: number;
  onPick: (size: { id: StickerSizePreset['id'] | 'CUSTOM'; widthMm: number; heightMm: number }) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const [wText, setWText] = useState('');
  const [hText, setHText] = useState('');
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setCustom(false);
      setWText(String(widthMm));
      setHText(String(heightMm));
    }
  }
  const w = Number(wText.replace(',', '.'));
  const h = Number(hText.replace(',', '.'));
  const customError = wText && hText ? validateCustomSize(w, h) : 'Enter a width and height in mm';

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware scrollable sheetStyle={styles.sheet}>
      {custom ? (
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Custom size</Text>
          <Text style={styles.sheetBody}>
            Width is the edge that goes across the print head. {CUSTOM_BOUNDS.minW}–{CUSTOM_BOUNDS.maxW} mm wide,{' '}
            {CUSTOM_BOUNDS.minH}–{CUSTOM_BOUNDS.maxH} mm tall.
          </Text>
          <View style={styles.pair}>
            <View style={styles.flex}>
              <LabelField label="Width (mm)" value={wText} onChangeText={setWText} keyboardType="decimal-pad" />
            </View>
            <View style={styles.flex}>
              <LabelField label="Height (mm)" value={hText} onChangeText={setHText} keyboardType="decimal-pad" />
            </View>
          </View>
          <Text style={[styles.sheetBody, !!customError && wText && hText ? styles.error : null]}>
            {customError && wText && hText ? customError : !customError ? dotsText(w, h, dpi) : ' '}
          </Text>
          <Pressable
            disabled={!!customError}
            onPress={() => {
              onPick({ id: 'CUSTOM', widthMm: w, heightMm: h });
              onClose();
            }}
            style={[styles.primary, !!customError && styles.primaryDisabled]}
            accessibilityRole="button"
          >
            <Text style={[styles.primaryText, !!customError && styles.primaryTextDisabled]}>Apply</Text>
          </Pressable>
          <Pressable onPress={() => setCustom(false)} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>Back</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Label size</Text>
          <Text style={styles.sheetBody}>
            Match this to the roll loaded in your printer. Width is the edge that goes across the print head.
          </Text>
          {STICKER_PRESETS.map((preset) => {
            const selected = preset.id === selectedId;
            return (
              <Pressable
                key={preset.id}
                onPress={() => {
                  onPick({ id: preset.id, widthMm: preset.widthMm, heightMm: preset.heightMm });
                  onClose();
                }}
                style={styles.presetRow}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={styles.glyphBox}>
                  <SizeGlyph widthMm={preset.widthMm} heightMm={preset.heightMm} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.presetTitle}>{sizeTitle(preset.widthMm, preset.heightMm)}</Text>
                  <Text style={styles.presetSubtitle}>
                    {preset.note ? `${preset.note} · ` : ''}
                    {dotsText(preset.widthMm, preset.heightMm, dpi)}
                  </Text>
                </View>
                {selected && <Ionicons name="checkmark" size={26} color={T.accent} />}
              </Pressable>
            );
          })}
          {selectedId === 'CUSTOM' && (
            <View style={styles.presetRow}>
              <View style={styles.glyphBox}>
                <SizeGlyph widthMm={widthMm} heightMm={heightMm} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.presetTitle}>{sizeTitle(widthMm, heightMm)}</Text>
                <Text style={styles.presetSubtitle}>Custom · {dotsText(widthMm, heightMm, dpi)}</Text>
              </View>
              <Ionicons name="checkmark" size={26} color={T.accent} />
            </View>
          )}
          <View style={styles.sheetDivider} />
          <Pressable onPress={() => setCustom(true)} style={styles.outlineButton} accessibilityRole="button">
            <MaterialCommunityIcons name="ruler" size={20} color={T.text} />
            <Text style={styles.outlineText}>Custom size…</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

const CAROUSEL: { value: StickerDesign; label: string }[] = [
  { value: 'reduced', label: 'Reduced' },
  { value: 'was_now', label: 'Was / Now' },
  // Third reference card is cropped ("Pri…"); title and layout are provisional.
  { value: 'price', label: 'Price' },
];

/** Horizontally scrolling design cards; next card clipped at the edge (R16). */
export function DesignCarousel({
  value,
  onChange,
  options,
}: {
  value: StickerDesign;
  onChange: (design: StickerDesign) => void;
  options: Pick<StickerOptions, 'background' | 'textColour'>;
}) {
  const cardW = 158;
  const thumbW = cardW - 20;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
      {CAROUSEL.map((design) => {
        const selected = design.value === value;
        const composition = renderSticker(design.value, STICKER_FIXTURE, { widthMm: 50, heightMm: 30, ...options });
        return (
          <Pressable
            key={design.value}
            onPress={() => onChange(design.value)}
            style={[styles.designCard, { width: cardW }, selected && styles.designCardSelected]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={design.label}
          >
            <View style={styles.thumbLabel}>
              <CompositionView composition={composition} scale={thumbW / 50} />
            </View>
            <Text style={[styles.designLabel, selected && styles.designLabelSelected]}>{design.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type Swatch = 'none' | 'ring' | { fill: string };

const BG_CHIPS: { value: StickerBackground; label: string; swatch: Swatch }[] = [
  { value: 'none', label: 'None', swatch: 'none' },
  { value: 'white', label: 'White', swatch: 'ring' },
  { value: 'yellow', label: 'Yellow', swatch: { fill: '#E9C230' } },
  { value: 'red', label: 'Red', swatch: { fill: '#E24A3B' } },
];
const TEXT_CHIPS: { value: StickerTextColour; label: string; swatch: Swatch }[] = [
  { value: 'black', label: 'Black', swatch: { fill: '#111111' } },
  { value: 'red', label: 'Red', swatch: { fill: '#E24A3B' } },
];

function SwatchDot({ swatch, selected }: { swatch: Swatch; selected: boolean }) {
  const base =
    swatch === 'none'
      ? styles.swatchNone
      : swatch === 'ring'
        ? styles.swatchRing
        : { backgroundColor: swatch.fill };
  return (
    <View style={[styles.swatch, base, selected && styles.swatchSelected]}>
      {selected && <Ionicons name="checkmark" size={17} color={swatch === 'none' ? T.text : T.textLight} />}
    </View>
  );
}

function ChipGroup<V extends string>({
  chips,
  value,
  onChange,
}: {
  chips: { value: V; label: string; swatch: Swatch }[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <View style={styles.chips}>
      {chips.map((chip) => {
        const selected = chip.value === value;
        return (
          <Pressable
            key={chip.value}
            onPress={() => onChange(chip.value)}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={chip.label}
          >
            <SwatchDot swatch={chip.swatch} selected={selected} />
            <Text style={styles.chipText}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const BackgroundChips = (props: { value: StickerBackground; onChange: (v: StickerBackground) => void }) => (
  <ChipGroup chips={BG_CHIPS} {...props} />
);
export const TextColourChips = (props: { value: StickerTextColour; onChange: (v: StickerTextColour) => void }) => (
  <ChipGroup chips={TEXT_CHIPS} {...props} />
);

/** Plain square-checkbox row on the grey page (R13/R14 "Print the date"). */
export function CheckRow({ title, helper, value, onChange }: { title: string; helper: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={styles.checkRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.checkbox, value && styles.checkboxOn]}>
        {value && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
      </View>
      <View style={styles.flex}>
        <Text style={styles.checkTitle}>{title}</Text>
        <Text style={styles.checkHelper}>{helper}</Text>
      </View>
    </Pressable>
  );
}

/** Wide grey surround with the physical sticker scaled to fit. */
export function StickerPreview({ composition }: { composition: LabelComposition }) {
  const [boxW, setBoxW] = useState(0);
  const maxH = 300;
  const scale = boxW > 0 ? Math.min(boxW / composition.widthMm, maxH / composition.heightMm) : 0;
  return (
    <View style={styles.previewSurround} onLayout={(e) => setBoxW(e.nativeEvent.layout.width - 32)}>
      {scale > 0 && (
        <View style={styles.previewLabel}>
          <CompositionView composition={composition} scale={scale} />
        </View>
      )}
    </View>
  );
}

/** Printer status card (R13): no direct printer driver exists yet — say so. */
export function PrinterStatusCard({ onSetUp }: { onSetUp: () => void }) {
  return (
    <Pressable onPress={onSetUp} style={styles.printerCard} accessibilityRole="button">
      <MaterialCommunityIcons name="printer-off-outline" size={24} color={T.textSecondary} />
      <View style={styles.flex}>
        <Text style={styles.printerTitle}>No label printer</Text>
        <Text style={styles.printerSubtitle}>Tap to set one up, or print to a sheet</Text>
      </View>
      <Text style={styles.link}>Set up</Text>
    </Pressable>
  );
}

export function PrintButton({ enabled, busy, onPress }: { enabled: boolean; busy: boolean; onPress: () => void }) {
  const active = enabled && !busy;
  return (
    <Pressable
      disabled={!active}
      onPress={onPress}
      style={({ pressed }) => [styles.printButton, active ? styles.printButtonOn : null, pressed && active && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !active, busy }}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <MaterialCommunityIcons name="printer" size={22} color={active ? '#FFFFFF' : C_DISABLED_TEXT} />
      )}
      <Text style={[styles.printText, active && styles.printTextOn]}>Print label</Text>
    </Pressable>
  );
}

/**
 * Printer setup (inferred). Truthful: PayMi has no direct label-printer driver
 * yet, so the working route is a PDF sized to the roll, printed from the
 * printer's own app or the system print dialog.
 */
export function PrinterSetupSheet({
  visible,
  sizeText,
  canPrint,
  busy,
  onPdf,
  onClose,
}: {
  visible: boolean;
  sizeText: string;
  canPrint: boolean;
  busy: boolean;
  onPdf: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable sheetStyle={styles.sheet}>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Label printer</Text>
        <Text style={styles.sheetBody}>
          Connecting a label printer directly isn’t available in PayMi yet. You can still print today: save a PDF
          sized exactly {sizeText}, one sticker per page, and print it from your printer’s own app or the system
          print dialog at 100% scale.
        </Text>
        <CapabilityList />
        <Pressable
          disabled={!canPrint || busy}
          onPress={onPdf}
          style={[styles.primary, (!canPrint || busy) && styles.primaryDisabled]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.primaryText, !canPrint && styles.primaryTextDisabled]}>Save PDF for label roll</Text>
          )}
        </Pressable>
        {!canPrint && <Text style={styles.centerNote}>Add a price to print.</Text>}
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Close</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

/** Help (inferred). Lists only what is actually supported — no invented models. */
export function PrinterHelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable sheetStyle={styles.sheet}>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Which sticker printers work?</Text>
        <Text style={styles.sheetBody}>
          PayMi doesn’t connect to label printers directly yet, so there’s no list of tested models.
        </Text>
        <CapabilityList />
        <Text style={styles.sheetBody}>
          Any printer that can print a PDF at its real size works today — for example through AirPrint on iPhone,
          the Android print service, or the printer maker’s app. Load the roll that matches the size you picked
          and turn off “fit to page”.
        </Text>
        <Text style={styles.sheetBody}>
          Thermal sticker printers print in black only; Yellow, Red and red text need a colour printer or
          pre-coloured labels.
        </Text>
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Got it</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

/** Currency picker (inferred): GBP is the only currency the catalogue supports. */
export function CurrencySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Currency</Text>
        <View style={styles.presetRow}>
          <Text style={[styles.presetTitle, styles.flex]}>GBP £</Text>
          <Ionicons name="checkmark" size={26} color={T.accent} />
        </View>
        <Text style={styles.sheetBody}>Prices are in pounds sterling.</Text>
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Close</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
  },
  sizeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  sizeTitle: { fontSize: 17.5, fontWeight: '600', color: T.text },
  sizeSubtitle: { fontSize: 13, color: T.textSecondary, marginTop: 3 },
  sheet: { backgroundColor: T.bg },
  sheetContent: { gap: 12, paddingBottom: 8 },
  sheetTitle: { fontSize: 19, fontWeight: '600', color: T.text, marginTop: 6 },
  sheetBody: { fontSize: 14, lineHeight: 20, color: T.textSecondary },
  error: { color: T.error },
  pair: { flexDirection: 'row', gap: 12, marginTop: 8 },
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingVertical: 12 },
  glyphBox: { width: 36, alignItems: 'center', justifyContent: 'center' },
  glyph: { borderWidth: 1.2, borderColor: T.textLight, borderRadius: 2 },
  presetTitle: { fontSize: 17.5, color: T.text },
  presetSubtitle: { fontSize: 13, color: T.textSecondary, marginTop: 3 },
  sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginTop: 4 },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
  },
  outlineText: { fontSize: 17, color: T.text },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 17, color: T.accent },
  primary: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: { backgroundColor: C_DISABLED },
  primaryText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  primaryTextDisabled: { color: C_DISABLED_TEXT },
  centerNote: { fontSize: 13.5, color: T.textSecondary, textAlign: 'center' },
  carousel: { gap: 10, paddingRight: T.insetPage },
  designCard: {
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    padding: 9,
    paddingBottom: 10,
    alignItems: 'center',
    gap: 10,
  },
  designCardSelected: { borderColor: T.accent, borderWidth: 2, padding: 8, paddingBottom: 9 },
  thumbLabel: { borderWidth: 1, borderColor: T.labelOutline, backgroundColor: T.surface },
  designLabel: { fontSize: 14.5, color: T.textSecondary },
  designLabelSelected: { color: T.text, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingLeft: 8,
    paddingRight: 18,
    borderRadius: 8,
    backgroundColor: CHIP_BG,
    minWidth: 96,
  },
  chipSelected: { backgroundColor: T.chipSelected },
  chipText: { fontSize: 15.5, color: T.text },
  swatch: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  swatchNone: { backgroundColor: T.textLight },
  swatchRing: { borderWidth: 1.5, borderColor: T.textLight, backgroundColor: '#FFFFFF' },
  swatchSelected: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: T.textSecondary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 26, paddingVertical: 6, paddingHorizontal: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: T.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: T.accent, borderColor: T.accent },
  checkTitle: { fontSize: 14.5, color: T.text },
  checkHelper: { fontSize: 12.5, color: T.textSecondary, marginTop: 3 },
  previewSurround: {
    backgroundColor: T.previewBg,
    borderRadius: T.radiusCard,
    padding: 16,
    alignItems: 'center',
  },
  previewLabel: { borderWidth: 1, borderColor: T.labelOutline, backgroundColor: T.surface },
  printerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  printerTitle: { fontSize: 15.5, fontWeight: '500', color: T.text },
  printerSubtitle: { fontSize: 12.5, color: T.textSecondary, marginTop: 2 },
  link: { fontSize: 15.5, color: T.accent },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: C_DISABLED,
  },
  printButtonOn: { backgroundColor: T.accent },
  printText: { fontSize: 17, color: C_DISABLED_TEXT },
  printTextOn: { color: '#FFFFFF', fontWeight: '600' },
});
