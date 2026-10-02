import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';

import type { MixedLayoutDefinition } from '../registry/manifest';
import { MIXED_CELLS, SIZE_LABEL } from '../registry/mixed-geometry';
import { LABEL_SIZES, type LabelSizeId } from '../registry/sizes';
import type { LabelComposition } from '../renderer-contract';
import { LabelTokens as T } from '../tokens';
import { CompositionView } from './composition-view';

const BLOCK_FILL = '#F1E3C6';
const BLOCK_LINE = T.accentBorder;
const PAGE_W = LABEL_SIZES.A4_PORTRAIT.widthMm;
const PAGE_H = LABEL_SIZES.A4_PORTRAIT.heightMm;

/** Miniature page schematic drawn from the real cell geometry (R02/R03). */
export function LayoutSchematic({ layoutId, width = 54 }: { layoutId: string; width?: number }) {
  const s = (width - 2) / PAGE_W;
  return (
    <View style={[styles.schematicPage, { width, height: PAGE_H * s + 2 }]}>
      {layoutId === 'M00' ? (
        <Ionicons name="add" size={34} color={T.accent} />
      ) : (
        (MIXED_CELLS[layoutId] ?? []).map((c, i) => (
          <View
            key={i}
            style={[styles.block, { left: c.xMm * s, top: c.yMm * s, width: c.wMm * s, height: c.hMm * s }]}
          />
        ))
      )}
    </View>
  );
}

export function LayoutRow({ layout, onPress }: { layout: MixedLayoutDefinition; onPress: () => void }) {
  const custom = !!layout.isCustom;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.layoutRow, custom && styles.customCard, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${layout.title}. ${layout.description}`}
    >
      <LayoutSchematic layoutId={layout.id} />
      <View style={styles.flex}>
        <Text style={styles.layoutTitle}>{layout.title}</Text>
        <Text style={styles.layoutDescription}>{layout.description}</Text>
        {!custom && <Text style={styles.layoutCount}>{layout.cells.length} labels</Text>}
      </View>
      <Ionicons name="chevron-forward" size={22} color={T.text} />
    </Pressable>
  );
}

export function PrintSheetCard({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View style={[styles.card, styles.printCard]}>
      <Text style={styles.cardHeading}>Print sheet</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Print sheet: ${label}`}
      >
        <Text style={styles.selectorText}>{label}</Text>
        <Ionicons name="caret-down" size={16} color={T.textSecondary} />
      </Pressable>
    </View>
  );
}

export function LayoutSummaryCard({
  layout,
  sheetLabel,
  onChange,
}: {
  layout: MixedLayoutDefinition;
  sheetLabel: string;
  onChange: () => void;
}) {
  return (
    <View style={[styles.card, styles.summary]}>
      <MaterialCommunityIcons name="view-grid-plus-outline" size={28} color={T.text} />
      <View style={styles.flex}>
        <Text style={styles.summaryTitle}>{layout.title}</Text>
        <Text style={styles.summaryText}>
          {layout.description} · {sheetLabel}
        </Text>
      </View>
      <Pressable onPress={onChange} hitSlop={10} accessibilityRole="button">
        <Text style={styles.change}>Change</Text>
      </Pressable>
    </View>
  );
}

export interface FilledSlot {
  title: string;
  subtitle: string;
  composition: LabelComposition | null;
  issue?: string;
}

/** One fixed slot (R01/R23). Empty: numbered tile + grey "Tap to fill" + size. */
export function SlotRow({
  number,
  sizeId,
  filled,
  onPress,
  trailing,
}: {
  number: number;
  sizeId: LabelSizeId;
  filled?: FilledSlot;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  const sizeLabel = SIZE_LABEL[sizeId] ?? LABEL_SIZES[sizeId].displayName;
  const c = filled?.composition;
  const thumbScale = c ? Math.min(64 / c.widthMm, 38 / c.heightMm) : 0;
  const label = filled ? `Slot ${number}: ${filled.title}, ${sizeLabel}` : `Slot ${number}: Tap to fill, ${sizeLabel}`;
  const body = (
    <>
      {c ? (
        <View style={styles.thumb}>
          <CompositionView composition={c} scale={thumbScale} />
        </View>
      ) : (
        <View style={styles.numberTile}>
          <Text style={styles.number}>{number}</Text>
        </View>
      )}
      <View style={styles.flex}>
        <Text style={filled ? styles.filledTitle : styles.tapToFill} numberOfLines={1}>
          {filled ? filled.title : 'Tap to fill'}
        </Text>
        <Text style={styles.slotSize} numberOfLines={1}>
          {filled ? `${number} · ${filled.subtitle}` : sizeLabel}
        </Text>
        {!!filled?.issue && (
          <Text style={styles.slotIssue} numberOfLines={1}>
            {filled.issue}
          </Text>
        )}
      </View>
    </>
  );
  const chevron = <Ionicons name="chevron-forward" size={22} color={T.text} />;
  if (!trailing) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, styles.slot, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {body}
        {chevron}
      </Pressable>
    );
  }
  // Trailing controls are buttons too, so they sit beside (not inside) the row's pressable area.
  return (
    <View style={[styles.card, styles.slot]}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.slotMain, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label}>
        {body}
      </Pressable>
      {trailing}
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit slot ${number}`}>
        {chevron}
      </Pressable>
    </View>
  );
}

export function RefreshPreviewButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <MaterialIcons name="preview" size={22} color={T.text} />
      <Text style={styles.refreshText}>Refresh preview</Text>
    </Pressable>
  );
}

export function GeneratePdfButton({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.pdf, pressed && styles.pdfPressed]}
      accessibilityRole="button"
      accessibilityState={{ busy }}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <MaterialIcons name="picture-as-pdf" size={22} color="#FFFFFF" />
      )}
      <Text style={styles.pdfText}>Generate PDF</Text>
    </Pressable>
  );
}

/** Refreshed sheet preview — the same compositions the PDF prints (guides preview-only). */
export function MixedPreview({ pages, stale }: { pages: LabelComposition[]; stale: boolean }) {
  const [w, setW] = useState(0);
  const page = pages[0];
  const scale = page && w > 0 ? w / page.widthMm : 0;
  return (
    <View style={styles.previewSurround} onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width - 40))}>
      {stale && <Text style={styles.stale}>Changed since the last refresh — tap Refresh preview to update.</Text>}
      {pages.length === 0 && <Text style={styles.stale}>Add a label to see the sheet.</Text>}
      {scale > 0 &&
        pages.map((p, i) => (
          <View key={i} style={styles.previewPageWrap}>
            {pages.length > 1 && (
              <Text style={styles.pageLabel}>
                Page {i + 1} of {pages.length}
              </Text>
            )}
            <View style={styles.previewPage}>
              <CompositionView composition={p} scale={scale} />
            </View>
          </View>
        ))}
    </View>
  );
}

export function SizePickerSheet({
  visible,
  sizes,
  onPick,
  onClose,
}: {
  visible: boolean;
  sizes: LabelSizeId[];
  onPick: (sizeId: LabelSizeId) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Add a label</Text>
        <Text style={styles.sheetBody}>Pick its size. Labels print at exactly this size and are arranged for you.</Text>
        {sizes.map((sizeId) => (
          <Pressable
            key={sizeId}
            onPress={() => {
              onPick(sizeId);
              onClose();
            }}
            style={({ pressed }) => [styles.sizeRow, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="label-outline" size={22} color={T.text} />
            <View style={styles.flex}>
              <Text style={styles.sizeTitle}>{SIZE_LABEL[sizeId]}</Text>
              <Text style={styles.sizeSubtitle}>
                {LABEL_SIZES[sizeId].widthMm} × {LABEL_SIZES[sizeId].heightMm} mm
              </Text>
            </View>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  card: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
  },
  schematicPage: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    position: 'absolute',
    backgroundColor: BLOCK_FILL,
    borderWidth: 1,
    borderColor: BLOCK_LINE,
  },
  layoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 10,
    paddingRight: 10,
  },
  customCard: {
    backgroundColor: T.accentSoft,
    borderColor: T.accentBorder,
  },
  layoutTitle: {
    fontSize: 16.5,
    fontWeight: '500',
    color: T.text,
  },
  layoutDescription: {
    fontSize: 13.5,
    lineHeight: 18.5,
    color: T.textSecondary,
    marginTop: 4,
  },
  layoutCount: {
    fontSize: 12.5,
    color: T.textLight,
    marginTop: 4,
  },
  printCard: {
    padding: 10,
    paddingTop: 14,
    gap: 10,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '500',
    color: T.text,
    marginLeft: 1,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 18,
  },
  selectorText: {
    fontSize: 18,
    color: T.text,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingLeft: 18,
    paddingRight: 30,
  },
  summaryTitle: {
    fontSize: 17,
    color: T.text,
  },
  summaryText: {
    fontSize: 14.5,
    lineHeight: 18,
    color: T.textSecondary,
    marginTop: 3,
  },
  change: {
    fontSize: 17,
    color: T.accent,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingLeft: 17,
    paddingRight: 22,
    minHeight: 66,
  },
  slotMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  numberTile: {
    width: 39,
    height: 39,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: T.borderStrong,
    backgroundColor: T.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontSize: 14.5,
    color: T.textSecondary,
  },
  thumb: {
    minWidth: 39,
    borderWidth: 1,
    borderColor: T.labelOutline,
    backgroundColor: T.surface,
    alignItems: 'center',
  },
  tapToFill: {
    fontSize: 18,
    color: T.textLight,
  },
  filledTitle: {
    fontSize: 16.5,
    color: T.text,
  },
  slotSize: {
    fontSize: 13,
    color: T.textSecondary,
    marginTop: 3,
  },
  slotIssue: {
    fontSize: 12.5,
    color: T.error,
    marginTop: 3,
  },
  refresh: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surfaceAlt,
  },
  refreshText: {
    fontSize: 17,
    color: T.text,
  },
  pdf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    backgroundColor: T.accent,
  },
  pdfPressed: {
    backgroundColor: T.accentPressed,
  },
  pdfText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  previewSurround: {
    backgroundColor: T.previewBg,
    borderRadius: T.radiusCard,
    padding: 20,
    gap: 12,
    alignItems: 'center',
  },
  previewPageWrap: {
    gap: 6,
    alignItems: 'center',
  },
  previewPage: {
    borderWidth: 1,
    borderColor: T.labelOutline,
    backgroundColor: T.surface,
  },
  pageLabel: {
    fontSize: 12.5,
    color: T.textSecondary,
  },
  stale: {
    fontSize: 13,
    color: T.textSecondary,
    textAlign: 'center',
  },
  sheet: {
    backgroundColor: T.bg,
  },
  sheetContent: {
    padding: 20,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: T.text,
  },
  sheetBody: {
    fontSize: 14,
    lineHeight: 20,
    color: T.textSecondary,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  sizeTitle: {
    fontSize: 16,
    color: T.text,
  },
  sizeSubtitle: {
    fontSize: 13,
    color: T.textSecondary,
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
