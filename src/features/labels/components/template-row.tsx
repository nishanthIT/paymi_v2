import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TEMPLATE_ICONS, TONES } from '../registry/catalogue-meta';
import type { TemplateDefinition } from '../registry/manifest';
import { renderTemplateFixture } from '../render/templates';
import { LabelTokens as T } from '../tokens';
import { CompositionView } from './composition-view';

const CHIP = {
  portrait: { bg: T.accentSoft, border: T.accentBorder, fg: T.accentPressed, icon: 'cellphone' as const, label: 'Portrait' },
  landscape: { bg: '#FBEBDD', border: '#E2A46B', fg: '#B0601F', icon: 'rectangle-outline' as const, label: 'Landscape' },
  products: { bg: '#E6F0E4', border: '#9CC096', fg: '#3D7A3A', icon: 'view-grid-outline' as const },
};

/** Orientation + product-count chips (A4 rows only, as in R05–R08). */
export function TemplateChips({ template }: { template: TemplateDefinition }) {
  const orient = CHIP[template.orientation];
  return (
    <View style={styles.chips}>
      <View style={[styles.chip, { backgroundColor: orient.bg, borderColor: orient.border }]}>
        <MaterialCommunityIcons name={orient.icon} size={12} color={orient.fg} />
        <Text style={[styles.chipText, { color: orient.fg }]}>{orient.label}</Text>
      </View>
      {template.productSlots > 1 && (
        <View style={[styles.chip, { backgroundColor: CHIP.products.bg, borderColor: CHIP.products.border }]}>
          <MaterialCommunityIcons name={CHIP.products.icon} size={12} color={CHIP.products.fg} />
          <Text style={[styles.chipText, { color: CHIP.products.fg }]}>{template.productSlots} products</Text>
        </View>
      )}
    </View>
  );
}

/** Catalogue row (R05–R12): pale thumbnail tile, pastel icon + title, grey subtitle, chips, chevron. */
export function TemplateRow({
  template,
  onPress,
  selected,
}: {
  template: TemplateDefinition;
  onPress: () => void;
  /** Design picker in a mixed-sheet slot: blue outline + tick instead of chevron. */
  selected?: boolean;
}) {
  const composition = renderTemplateFixture(template.id);
  const ratio = composition.widthMm / composition.heightMm;
  const isA4 = template.section === 'A4';
  // R05–R12: wide shelf cards get a 98 pt tile; squarer cards (7 × 7, 4 × 3) and A4 pages get 80 pt.
  const tileW = ratio < 1.5 || isA4 ? 80 : 98;
  const tileH = isA4 ? 84 : 80;
  const fitW = tileW - (isA4 ? 12 : 8);
  const fitH = tileH - (isA4 ? 12 : 8);
  const scale = Math.min(fitW / composition.widthMm, fitH / composition.heightMm);
  const meta = TEMPLATE_ICONS[template.id];
  const tone = TONES[meta.tone];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${template.title}. ${template.subtitle}`}
      accessibilityState={selected != null ? { selected } : undefined}
      style={({ pressed }) => [styles.row, selected && styles.selected, pressed && styles.pressed]}
    >
      <View style={[styles.tile, { width: tileW, height: tileH }]}>
        <View style={styles.label}>
          <CompositionView composition={composition} scale={scale} />
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={[styles.iconTile, { backgroundColor: tone.bg }]}>
            <MaterialCommunityIcons name={meta.icon} size={18} color={tone.fg} />
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {template.title}
          </Text>
        </View>
        <Text style={styles.subtitle}>{template.subtitle}</Text>
        {isA4 && <TemplateChips template={template} />}
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color={T.accent} />
      ) : selected === false ? (
        <Ionicons name="ellipse-outline" size={22} color={T.borderStrong} />
      ) : (
        <Ionicons name="chevron-forward" size={20} color={T.textLight} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    padding: 8,
    paddingRight: 10,
  },
  pressed: {
    backgroundColor: T.pressed,
  },
  selected: {
    borderColor: T.accent,
    borderWidth: 2,
    padding: 7,
    paddingRight: 9,
  },
  tile: {
    borderRadius: 6,
    backgroundColor: T.thumbTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    borderWidth: 1,
    borderColor: T.labelOutline,
    backgroundColor: T.surface,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 15,
    color: T.text,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    color: T.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
});
