import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CompositionView } from '@/features/labels/components/composition-view';
import { HandheldScanCapture } from '@/features/labels/components/handheld-scan-capture';
import { LabelField } from '@/features/labels/components/label-field';
import { LabelsScreen } from '@/features/labels/components/labels-screen';
import { EditorMenu } from '@/features/labels/components/labels-menu';
import { ProductEditorSheet } from '@/features/labels/components/product-editor-sheet';
import { ProductRow } from '@/features/labels/components/product-rows';
import { ProductSearchSheet } from '@/features/labels/components/product-search-sheet';
import { ScanSearchButtons } from '@/features/labels/components/scan-search-buttons';
import { TemplateChips } from '@/features/labels/components/template-row';
import { ToolPlaceholder } from '@/features/labels/components/tool-placeholder';
import { useLabelDraft } from '@/features/labels/hooks/use-label-draft';
import { useLabelLibrary } from '@/features/labels/hooks/use-label-library';
import { PrintAction, useLabelOutput } from '@/features/labels/components/label-output';
import { draftSummary } from '@/features/labels/render/draft-preview';
import { itemPrintIssues } from '@/features/labels/render/print-checks';
import { composeTemplatePages } from '@/features/labels/render/print-jobs';
import type { LabelItem } from '@/features/labels/model/label-item';
import { TEMPLATE_FIELDS } from '@/features/labels/registry/catalogue-meta';
import { TEMPLATES } from '@/features/labels/registry/manifest';
import { LABEL_SIZES } from '@/features/labels/registry/sizes';
import { itemToTalkerContent, readTalkerSettings, type TalkerSettings } from '@/features/labels/render/talker-settings';
import { hasTemplateRenderer, renderTemplate, slotCount } from '@/features/labels/render/templates';
import { subscribeLabelScan } from '@/features/labels/scan-bridge';
import { LabelTokens as T } from '@/features/labels/tokens';

/**
 * Template editor (inferred — not in the references): the chosen design with
 * one independent product per slot (duo/trio posters have 2/3), previewed from
 * the same renderer as its catalogue thumbnail.
 */
export default function TemplateEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template || !hasTemplateRenderer(template.id)) {
    return <ToolPlaceholder title="Template" note="This design isn’t available yet." />;
  }
  return <TemplateEditor templateId={template.id} />;
}

/** Slot → item id ('' = empty). Older single-product drafts have no slots: use item order. */
function readSlots(stored: Record<string, unknown>, items: LabelItem[], count: number): string[] {
  const raw = Array.isArray(stored.slots) ? (stored.slots as unknown[]) : items.map((i) => i.id);
  return Array.from({ length: count }, (_, k) => {
    const v = raw[k];
    return typeof v === 'string' && items.some((i) => i.id === v) ? v : '';
  });
}

function TemplateEditor({ templateId }: { templateId: string }) {
  const router = useRouter();
  const template = TEMPLATES.find((t) => t.id === templateId)!;
  const fields = TEMPLATE_FIELDS[templateId] ?? {};
  const count = slotCount(templateId);
  const labels = useLabelDraft(`TEMPLATE_${templateId}`);
  const { addScan, addFromSearch, addCustom, removeItem, setSettings: saveSettings } = labels;
  const settings = readTalkerSettings(labels.draft.settings);
  const slots = readSlots(labels.draft.settings, labels.draft.items, count);
  const slotItems = slots.map((sid) => labels.draft.items.find((i) => i.id === sid));

  const [searchOpen, setSearchOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [previewW, setPreviewW] = useState(0);
  const output = useLabelOutput();
  const library = useLabelLibrary({ load: false });
  const [printBlocked, setPrintBlocked] = useState(false);
  /** Slot the open scanner/search was started for, so its result lands there. */
  const targetSlot = useRef<number | null>(null);
  /** Latest slot ids, so back-to-back scans in one frame don’t both claim the same slot. */
  const slotsRef = useRef(slots);
  useEffect(() => {
    slotsRef.current = slots;
  });

  const setSetting = useCallback(
    <K extends keyof TalkerSettings>(key: K, value: TalkerSettings[K]) => saveSettings({ [key]: value }),
    [saveSettings],
  );

  /** Put a new item in one slot, replacing (and discarding) whatever was there. */
  const place = useCallback(
    (slot: number, create: () => LabelItem | null) => {
      const current = slotsRef.current;
      const item = create();
      if (!item) return null;
      if (current[slot]) removeItem(current[slot]);
      const next = current.map((sid, k) => (k === slot ? item.id : sid));
      slotsRef.current = next;
      saveSettings({ slots: next });
      setNotice('');
      return item;
    },
    [removeItem, saveSettings],
  );

  /** A scan fills the slot it was started for; otherwise the first empty slot. */
  const onBarcode = useCallback(
    (barcode: string) => {
      const target = targetSlot.current;
      targetSlot.current = null;
      const empty = slotsRef.current.indexOf('');
      const slot = target ?? (count === 1 ? 0 : empty);
      if (slot < 0) {
        setNotice(`All ${count} products are filled. Use Scan on a product to replace it.`);
        return;
      }
      place(slot, () => addScan(barcode));
    },
    [count, place, addScan],
  );
  useEffect(() => subscribeLabelScan(onBarcode), [onBarcode]);

  const openScanner = (slot: number) => {
    targetSlot.current = slot;
    router.push({ pathname: '/(app)/scanner', params: { intent: 'label' } });
  };
  const openSearch = (slot: number) => {
    targetSlot.current = slot;
    setSearchOpen(true);
  };
  const clearSlot = (slot: number) => {
    const sid = slotsRef.current[slot];
    if (!sid) return;
    removeItem(sid);
    const next = slotsRef.current.map((v, k) => (k === slot ? '' : v));
    slotsRef.current = next;
    saveSettings({ slots: next });
  };

  const shared = {
    headline: settings.headline.trim() || undefined,
    listText: settings.listText.trim() || undefined,
    footer: settings.footer.trim() || undefined,
  };
  const contents = slotItems.map((item) =>
    item || count === 1 ? itemToTalkerContent(item, settings) : null,
  );
  const composition = renderTemplate(templateId, contents, shared);
  const size = LABEL_SIZES[template.sizeId];
  const maxPreviewH = template.section === 'A4' ? 380 : 280;
  const scale = previewW > 0 ? Math.min(previewW / size.widthMm, maxPreviewH / size.heightMm) : 0;

  const label = (k: number) => (count > 1 ? `Product ${k + 1}` : 'Product');
  const issues = [
    ...slotItems.flatMap((item, k) =>
      item
        ? itemPrintIssues(item, composition, { checkCopies: count === 1 }).map((e) => (count > 1 ? `${label(k)}: ${e}` : e))
        : count > 1
          ? [`${label(k)} is empty — scan or search to fill it`]
          : [],
    ),
    ...composition.warnings,
  ].filter((v, i, a) => a.indexOf(v) === i);

  const printCard = () => {
    if (output.busy) return;
    if (!slotItems.some(Boolean)) return setPrintBlocked(true);
    if (issues.length) return setPrintBlocked(true);
    setPrintBlocked(false);
    const copies = count === 1 ? Math.max(1, slotItems[0]!.copies) : 1;
    const pages = composeTemplatePages(composition, copies);
    const draft = labels.draft;
    output.start({ title: template.title, pages }, (outcome) => {
      if (outcome === 'cancelled') return;
      library
        .recordJob({ toolId: `TEMPLATE_${templateId}`, title: template.title, summary: draftSummary(draft).summary, output: 'sheet', pages, copies: 1, outcome, draft })
        .catch(() => {});
    });
  };
  const editingItem = editingSlot != null ? slotItems[editingSlot] : undefined;

  return (
    <LabelsScreen title={template.title} right={<EditorMenu labels={labels} />}>
      <HandheldScanCapture active={labels.hydrated && !searchOpen && editingSlot == null} onBarcode={onBarcode} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.caption}>{template.subtitle}</Text>
        {template.section === 'A4' && <TemplateChips template={template} />}

        <View style={styles.previewSurround} onLayout={(e) => setPreviewW(e.nativeEvent.layout.width - 32)}>
          {scale > 0 && (
            <View style={styles.previewLabel}>
              <CompositionView composition={composition} scale={scale} />
            </View>
          )}
        </View>
        <Text style={styles.sizeNote}>
          Actual size {size.widthMm} × {size.heightMm} mm
        </Text>

        {slotItems.map((item, k) => (
          <View key={k} style={styles.slot}>
            <Text style={styles.heading}>{label(k)}</Text>
            {item ? (
              <ProductRow
                item={item}
                onPress={() => setEditingSlot(k)}
                onRemove={() => clearSlot(k)}
                onCopies={(copies) => labels.updateItem(item.id, (i) => ({ ...i, copies }))}
              />
            ) : (
              <Text style={styles.hint}>
                {count > 1
                  ? `Scan or search for product ${k + 1}. Each product has its own name and price.`
                  : 'Scan or search for the product this card is for.'}
              </Text>
            )}
            <ScanSearchButtons onScan={() => openScanner(k)} onSearch={() => openSearch(k)} />
            {fields.photo && item && !item.snapshot.imageUri && (
              <Text style={styles.hint}>
                This design has space for a photo. Add one in the product details, or it prints without a photo.
              </Text>
            )}
          </View>
        ))}
        {template.twinPhotoSharedProduct && (
          <Text style={styles.hint}>This design shows the product photo twice — both are this same product.</Text>
        )}
        {!!notice && <Text style={styles.notice}>{notice}</Text>}

        {(fields.headline || fields.list) && <Text style={styles.heading}>Card text</Text>}
        {fields.headline && (
          <LabelField
            label="Badge text"
            value={settings.headline}
            onChangeText={(v) => setSetting('headline', v)}
            placeholder={fields.headline}
            helper={`Shown as ${fields.headline} when left empty`}
            autoCapitalize="characters"
          />
        )}
        {fields.list && (
          <LabelField
            label="Products in the offer"
            value={settings.listText}
            onChangeText={(v) => setSetting('listText', v)}
            placeholder="e.g. Any 2 bottles of red or white"
            helper="Optional · add multi-buy quantity and total in the product details"
          />
        )}
        <LabelField
          label="Small print"
          value={settings.footer}
          onChangeText={(v) => setSetting('footer', v)}
          placeholder="e.g. While stocks last"
          helper="Optional · only printed if you add it"
        />

        {issues.length > 0 && (
          <View style={styles.issues}>
            {issues.map((issue) => (
              <Text key={issue} style={styles.issueText}>
                {issue}
              </Text>
            ))}
          </View>
        )}
        {printBlocked && !slotItems.some(Boolean) && (
          <View style={styles.issues}>
            <Text style={styles.issueText}>Add a product first — the sample artwork never prints.</Text>
          </View>
        )}
        <PrintAction label="Print" busy={output.busy} onPress={printCard} />
      </ScrollView>

      <ProductSearchSheet
        visible={searchOpen}
        onClose={() => {
          setSearchOpen(false);
          targetSlot.current = null;
        }}
        onPick={(result) => {
          const slot = targetSlot.current ?? 0;
          place(slot, () => addFromSearch(result));
        }}
        onBarcode={(barcode) => {
          // Keep the target: a typed/handheld barcode in the sheet fills the slot it was opened for.
          const slot = targetSlot.current ?? 0;
          place(slot, () => addScan(barcode));
        }}
        onScan={() => {
          const slot = targetSlot.current ?? 0;
          setSearchOpen(false);
          openScanner(slot);
        }}
        onAddCustom={() => {
          const slot = targetSlot.current ?? 0;
          targetSlot.current = null;
          if (place(slot, () => addCustom())) setEditingSlot(slot);
        }}
      />
      <ProductEditorSheet
        item={editingItem ?? null}
        visible={editingSlot != null && !!editingItem}
        onUpdate={(update) => editingItem && labels.updateItem(editingItem.id, update)}
        onRetryLookup={() => editingItem && labels.retryLookup(editingItem.id)}
        onClose={() => setEditingSlot(null)}
        onRemove={() => {
          if (editingSlot != null) clearSlot(editingSlot);
          setEditingSlot(null);
        }}
      />
      {output.sheet}
    </LabelsScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: T.insetPage,
    paddingBottom: 56,
    gap: 12,
  },
  caption: {
    fontSize: 13.5,
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
  hint: {
    fontSize: 13.5,
    lineHeight: 19,
    color: T.textSecondary,
  },
  slot: {
    gap: 12,
  },
  notice: {
    fontSize: 13.5,
    lineHeight: 19,
    color: T.text,
    backgroundColor: T.accentSoft,
    borderRadius: 12,
    padding: 12,
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
});
