import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { renderShelfLabel, type ShelfDesign, type ShelfLabelContent } from '../render/shelf-label';
import { WIDTH_STEPS } from '../render/shelf-settings';
import { LabelTokens as T } from '../tokens';
import { CompositionView } from './composition-view';

/** Selected sheet card (R18 top): grid icon, title/subtitle, blue Change, lavender rule, hint. */
export function SheetCard({
  title,
  subtitle,
  onChange,
}: {
  title: string;
  subtitle: string;
  onChange: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sheetRow}>
        <MaterialCommunityIcons name="grid" size={26} color={T.text} />
        <View style={styles.flex}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.sheetSubtitle}>{subtitle}</Text>
        </View>
        <Pressable onPress={onChange} hitSlop={10} accessibilityRole="button">
          <Text style={styles.link}>Change</Text>
        </Pressable>
      </View>
      <View style={styles.lavenderRule} />
      <Text style={styles.hint}>Scan a barcode to start — a handheld scanner works straight away.</Text>
    </View>
  );
}

export function SectionHeading({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.headingRow}>
      <Text style={styles.heading}>{title}</Text>
      {right}
    </View>
  );
}

/** Two equal-width design cards; selected card has the blue outline. */
export function DesignPicker({
  designs,
  value,
  onChange,
  fixture,
  optionsForThumb,
}: {
  designs: { value: ShelfDesign; label: string }[];
  value: ShelfDesign;
  onChange: (design: ShelfDesign) => void;
  fixture: ShelfLabelContent;
  optionsForThumb: Parameters<typeof renderShelfLabel>[2];
}) {
  const [thumbW, setThumbW] = useState(0);
  return (
    <View style={styles.designRow}>
      {designs.map((design) => {
        const selected = design.value === value;
        const composition = renderShelfLabel(design.value, fixture, optionsForThumb);
        const scale = thumbW > 0 ? thumbW / composition.widthMm : 0;
        return (
          <Pressable
            key={design.value}
            onPress={() => onChange(design.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.designCard, selected && styles.designCardSelected]}
          >
            <View
              style={styles.designThumb}
              onLayout={(e) => setThumbW(Math.floor(e.nativeEvent.layout.width))}
            >
              {scale > 0 && (
                <View style={styles.thumbLabel}>
                  <CompositionView composition={composition} scale={scale} />
                </View>
              )}
            </View>
            <Text style={[styles.designLabel, selected && styles.designLabelSelected]}>{design.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface OptionRowSpec {
  key: string;
  title: string;
  helper: React.ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Options card: square checkboxes (blue fill + white tick when checked) with separators. */
export function OptionsCard({ rows }: { rows: OptionRowSpec[] }) {
  return (
    <View style={[styles.card, styles.optionsCard]}>
      {rows.map((row, index) => (
        <Pressable
          key={row.key}
          onPress={() => row.onChange(!row.value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: row.value }}
          style={[styles.optionRow, index > 0 && styles.optionDivider]}
        >
          <View style={[styles.checkbox, row.value && styles.checkboxOn]}>
            {row.value && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
          </View>
          <View style={styles.flex}>
            <Text style={styles.optionTitle}>{row.title}</Text>
            <Text style={styles.optionHelper}>{row.helper}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** "£1.⁹⁵" — raised small pence inside helper copy. */
export function RaisedPenceExample() {
  return (
    <Text>
      £1.<Text style={styles.raised}>95</Text>
    </Text>
  );
}

/** Stepped width slider: tick marks and a large thumb (R17). */
export function WidthSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, WIDTH_STEPS.indexOf(value));
  const last = WIDTH_STEPS.length - 1;

  const pick = (x: number) => {
    if (width <= 0) return;
    const step = Math.round((Math.min(Math.max(x, 0), width) / width) * last);
    if (WIDTH_STEPS[step] !== value) onChange(WIDTH_STEPS[step]);
  };

  const thumbX = width > 0 ? (index / last) * width : 0;

  return (
    <View
      style={styles.sliderHit}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: last, now: index }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const next = e.nativeEvent.actionName === 'increment' ? Math.min(last, index + 1) : Math.max(0, index - 1);
        onChange(WIDTH_STEPS[next]);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
      onResponderMove={(e) => pick(e.nativeEvent.locationX)}
    >
      <View style={styles.sliderTrack} pointerEvents="none">
        <View style={[styles.sliderFill, { width: thumbX }]} />
        {WIDTH_STEPS.map((_, i) => (
          <View key={i} style={[styles.tick, { left: (i / last) * width - 1.5 }]} />
        ))}
      </View>
      <View style={[styles.sliderThumb, { left: thumbX - 17 }]} pointerEvents="none" />
    </View>
  );
}

/** Settings card under the preview: Start at row + label-width slider. */
export function SheetSettingsCard({
  startAt,
  onStartAt,
  widthRatio,
  onWidth,
}: {
  startAt: number;
  onStartAt: () => void;
  widthRatio: number;
  onWidth: (value: number) => void;
}) {
  const used = startAt - 1;
  return (
    <View style={[styles.card, styles.settingsCard]}>
      <View style={styles.settingsRow}>
        <MaterialCommunityIcons name="pound" size={24} color={T.text} />
        <Text style={styles.settingsText}>
          {used > 0 ? `Starting at label ${startAt} — ${used} already used` : 'Starting at label 1 — a fresh sheet'}
        </Text>
        <Pressable onPress={onStartAt} hitSlop={10} accessibilityRole="button">
          <Text style={styles.link}>Start at</Text>
        </Pressable>
      </View>
      <View style={styles.settingsDivider} />
      <View style={styles.settingsRow}>
        <MaterialCommunityIcons name="ruler" size={24} color={T.text} />
        <Text style={styles.settingsText}>
          {widthRatio >= 1
            ? 'Using the whole width of the label'
            : `Using ${Math.round(widthRatio * 100)}% of the label width`}
        </Text>
      </View>
      <View style={styles.sliderPad}>
        <WidthSlider value={widthRatio} onChange={onWidth} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetTitle: {
    fontSize: 16.5,
    fontWeight: '600',
    color: T.text,
  },
  sheetSubtitle: {
    fontSize: 12.5,
    color: T.textSecondary,
    marginTop: 2,
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: T.accent,
  },
  lavenderRule: {
    height: 5,
    borderRadius: 3,
    backgroundColor: T.chipSelected,
    marginTop: 14,
    marginBottom: 10,
  },
  hint: {
    fontSize: 13.5,
    lineHeight: 19,
    color: T.textSecondary,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  heading: {
    fontSize: 18.5,
    fontWeight: '500',
    color: T.text,
  },
  designRow: {
    flexDirection: 'row',
    gap: 12,
  },
  designCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    padding: 10,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 10,
  },
  designCardSelected: {
    borderColor: T.accent,
    borderWidth: 2,
    padding: 9,
    paddingBottom: 11,
  },
  designThumb: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  thumbLabel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.labelOutline,
    backgroundColor: T.surface,
  },
  designLabel: {
    fontSize: 15,
    color: T.text,
  },
  designLabelSelected: {
    fontWeight: '600',
  },
  optionsCard: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  optionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.divider,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: T.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: T.accent,
    borderColor: T.accent,
  },
  optionTitle: {
    fontSize: 15.5,
    color: T.text,
  },
  optionHelper: {
    fontSize: 13.5,
    lineHeight: 19,
    color: T.textSecondary,
    marginTop: 2,
  },
  raised: {
    fontSize: 9,
    lineHeight: 12,
  },
  settingsCard: {
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  settingsText: {
    flex: 1,
    fontSize: 14.5,
    color: T.text,
  },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.divider,
  },
  sliderPad: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  sliderHit: {
    height: 40,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: T.chipSelected,
    overflow: 'visible',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
    backgroundColor: T.accent,
  },
  tick: {
    position: 'absolute',
    top: 1.5,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  sliderThumb: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.accent,
    top: 3,
  },
});
