import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LabelDraftApi } from '../hooks/use-label-draft';
import type { LabelItem } from '../model/label-item';
import { compatibleTemplates, type MixedEntry } from '../model/mixed';
import { APP_MARKET, TEMPLATE_FIELDS } from '../registry/catalogue-meta';
import { SIZE_LABEL } from '../registry/mixed-geometry';
import { LABEL_SIZES } from '../registry/sizes';
import { entryIssues, renderEntry } from '../render/mixed-sheet';
import { subscribeLabelScan } from '../scan-bridge';
import { LabelTokens as T } from '../tokens';
import { CompositionView } from './composition-view';
import { HandheldScanCapture } from './handheld-scan-capture';
import { LabelField } from './label-field';
import { LabelsScreen } from './labels-screen';
import { ProductEditorSheet } from './product-editor-sheet';
import { ProductRow } from './product-rows';
import { ProductSearchSheet } from './product-search-sheet';
import { ScanSearchButtons } from './scan-search-buttons';
import { TemplateRow } from './template-row';

type Patch = Partial<Omit<MixedEntry, 'id' | 'sizeId'>>;

/**
 * Fill one mixed-sheet label (inferred screen): a design of exactly the slot's
 * physical size, its product, card text and — in Custom — copies. Everything
 * applies to this entry only, so results can't land in another slot.
 */
export function MixedSlotEditor({
  heading,
  entry,
  item,
  labels,
  onPatch,
  onDone,
  onRemove,
  duplicateTargets,
  onDuplicate,
  showCopies,
}: {
  heading: string;
  entry: MixedEntry;
  item: LabelItem | undefined;
  labels: LabelDraftApi;
  onPatch: (patch: Patch) => void;
  onDone: () => void;
  onRemove: () => void;
  /** Fixed layouts: empty compatible slots (1-based) a copy can go into. Custom: [] + onDuplicate. */
  duplicateTargets: number[];
  onDuplicate: (target?: number) => void;
  showCopies: boolean;
}) {
  const router = useRouter();
  const { addScan, addFromSearch, addCustom, removeItem } = labels;
  const [showAll, setShowAll] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [previewW, setPreviewW] = useState(0);

  const designs = compatibleTemplates(entry.sizeId, showAll);
  const fields = (entry.templateId && TEMPLATE_FIELDS[entry.templateId]) || {};
  const sizeLabel = SIZE_LABEL[entry.sizeId] ?? LABEL_SIZES[entry.sizeId].displayName;
  const composition = renderEntry(entry, item);
  const issues = entryIssues(entry, item, composition);
  const scale = composition && previewW > 0 ? Math.min(previewW / composition.widthMm, 200 / composition.heightMm) : 0;

  /** Replace this label's product; the old item goes so nothing is orphaned. */
  const setProduct = useCallback(
    (create: () => LabelItem | null) => {
      const next = create();
      if (!next) return null;
      if (entry.itemId) removeItem(entry.itemId);
      onPatch({ itemId: next.id });
      return next;
    },
    [entry.itemId, removeItem, onPatch],
  );
  const onBarcode = useCallback((barcode: string) => setProduct(() => addScan(barcode)), [setProduct, addScan]);
  useEffect(() => subscribeLabelScan(onBarcode), [onBarcode]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDone();
      return true;
    });
    return () => sub.remove();
  }, [onDone]);

  const openScanner = () => router.push({ pathname: '/(app)/scanner', params: { intent: 'label' } });

  return (
    <LabelsScreen title={heading} onBack={onDone}>
      <HandheldScanCapture active={labels.hydrated && !searchOpen && !editorOpen} onBarcode={onBarcode} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Design</Text>
          <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={10} accessibilityRole="button" style={styles.showAll}>
            <MaterialCommunityIcons name={showAll ? 'filter-outline' : 'filter-off-outline'} size={18} color={T.accent} />
            <Text style={styles.showAllText}>{showAll ? `${APP_MARKET} only` : 'Show all'}</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Only designs made for exactly {sizeLabel.replace(/^.*· /, '')} are shown. Other sizes aren’t shrunk or stretched to fit.
        </Text>
        {designs.map((t) => (
          <TemplateRow key={t.id} template={t} selected={t.id === entry.templateId} onPress={() => onPatch({ templateId: t.id })} />
        ))}
        {designs.length === 0 && <Text style={styles.hint}>No designs are available for this size yet.</Text>}

        {composition && (
          <View style={styles.previewSurround} onLayout={(e) => setPreviewW(e.nativeEvent.layout.width - 32)}>
            {scale > 0 && (
              <View style={styles.previewLabel}>
                <CompositionView composition={composition} scale={scale} />
              </View>
            )}
          </View>
        )}

        <Text style={styles.heading}>Product</Text>
        {item ? (
          <ProductRow
            item={item}
            onPress={() => setEditorOpen(true)}
            onRemove={() => {
              removeItem(item.id);
              onPatch({ itemId: undefined });
            }}
          />
        ) : (
          <Text style={styles.hint}>Scan or search for the product this label is for.</Text>
        )}
        <ScanSearchButtons onScan={openScanner} onSearch={() => setSearchOpen(true)} />

        {(fields.headline || fields.list) && <Text style={styles.heading}>Card text</Text>}
        {fields.headline && (
          <LabelField
            label="Badge text"
            value={entry.headline}
            onChangeText={(v) => onPatch({ headline: v })}
            placeholder={fields.headline}
            helper={`Shown as ${fields.headline} when left empty`}
            autoCapitalize="characters"
          />
        )}
        {fields.list && (
          <LabelField
            label="Products in the offer"
            value={entry.listText}
            onChangeText={(v) => onPatch({ listText: v })}
            placeholder="e.g. Any 2 bottles of red or white"
            helper="Optional · add multi-buy quantity and total in the product details"
          />
        )}
        {entry.templateId && (
          <LabelField
            label="Small print"
            value={entry.footer}
            onChangeText={(v) => onPatch({ footer: v })}
            placeholder="e.g. While stocks last"
            helper="Optional · only printed if you add it"
          />
        )}

        {showCopies && (
          <View style={styles.copiesRow}>
            <Text style={styles.copiesLabel}>Copies on the sheet</Text>
            <Pressable
              onPress={() => onPatch({ copies: Math.max(1, entry.copies - 1) })}
              disabled={entry.copies <= 1}
              style={styles.stepper}
              accessibilityRole="button"
              accessibilityLabel="Fewer copies"
            >
              <Ionicons name="remove" size={20} color={entry.copies <= 1 ? T.textLight : T.text} />
            </Pressable>
            <Text style={styles.copies}>{entry.copies}</Text>
            <Pressable
              onPress={() => onPatch({ copies: Math.min(99, entry.copies + 1) })}
              style={styles.stepper}
              accessibilityRole="button"
              accessibilityLabel="More copies"
            >
              <Ionicons name="add" size={20} color={T.text} />
            </Pressable>
          </View>
        )}

        {issues.length > 0 && (
          <View style={styles.issues}>
            {issues.map((issue) => (
              <Text key={issue} style={styles.issueText}>
                {issue}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          {showCopies ? (
            <ActionButton icon="content-copy" label="Duplicate label" onPress={() => onDuplicate()} />
          ) : (
            duplicateTargets.map((n) => (
              <ActionButton key={n} icon="content-copy" label={`Copy to slot ${n}`} onPress={() => onDuplicate(n)} />
            ))
          )}
          <ActionButton
            icon="trash-can-outline"
            danger
            label={confirmRemove ? 'Tap again to clear this label' : showCopies ? 'Remove label' : 'Clear slot'}
            onPress={() => (confirmRemove ? onRemove() : setConfirmRemove(true))}
          />
        </View>
        <Pressable onPress={onDone} style={styles.done} accessibilityRole="button">
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </ScrollView>

      <ProductSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={(result) => setProduct(() => addFromSearch(result))}
        onBarcode={onBarcode}
        onScan={() => {
          setSearchOpen(false);
          openScanner();
        }}
        onAddCustom={() => {
          if (setProduct(() => addCustom())) setEditorOpen(true);
        }}
      />
      <ProductEditorSheet
        item={item ?? null}
        visible={editorOpen && !!item}
        onUpdate={(update) => item && labels.updateItem(item.id, update)}
        onRetryLookup={() => item && labels.retryLookup(item.id)}
        onClose={() => setEditorOpen(false)}
        onRemove={() => {
          if (item) removeItem(item.id);
          onPatch({ itemId: undefined });
          setEditorOpen(false);
        }}
      />
    </LabelsScreen>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const colour = danger ? T.error : T.accent;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <MaterialCommunityIcons name={icon} size={20} color={colour} />
      <Text style={[styles.actionText, { color: colour }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: T.insetPage,
    paddingBottom: 56,
    gap: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 17.5,
    fontWeight: '500',
    color: T.text,
    marginTop: 4,
  },
  showAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  showAllText: {
    fontSize: 15,
    color: T.accent,
  },
  hint: {
    fontSize: 13.5,
    lineHeight: 19,
    color: T.textSecondary,
  },
  previewSurround: {
    backgroundColor: T.previewBg,
    borderRadius: T.radiusCard,
    padding: 16,
    alignItems: 'center',
  },
  previewLabel: {
    borderWidth: 1,
    borderColor: T.labelOutline,
    backgroundColor: T.surface,
  },
  copiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
  },
  copiesLabel: {
    flex: 1,
    fontSize: 15.5,
    color: T.text,
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
  actions: {
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 14,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
  },
  actionText: {
    fontSize: 15.5,
  },
  done: {
    height: 46,
    borderRadius: 14,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
