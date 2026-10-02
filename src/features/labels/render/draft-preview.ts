/** Title, one-line summary and first-label preview for any stored draft (Recent / Saved rows). */
import type { LabelDraft } from '../model/draft';
import type { LabelItem } from '../model/label-item';
import { toolInfo } from '../model/library';
import { readMixedState } from '../model/mixed';
import { parseMoneyText } from '../model/money';
import { MIXED_LAYOUTS } from '../registry/manifest';
import type { LabelComposition } from '../renderer-contract';
import { buildMixedJob } from './mixed-sheet';
import { renderSticker } from './reduced-sticker';
import { renderShelfLabel } from './shelf-label';
import { readRunnerSettings, renderRunner } from './shelf-runner';
import { itemToShelfContent, readShelfSettings } from './shelf-settings';
import { itemToStickerContent, readStickerSettings } from './sticker-settings';
import { itemToTalkerContent, readTalkerSettings } from './talker-settings';
import { renderTemplate, slotCount } from './templates';

const hasContent = (i: LabelItem) => !!(i.snapshot.displayName.trim() || i.snapshot.barcode.trim() || i.priceText.trim());
const price = (i: LabelItem | undefined) => {
  const p = parseMoneyText(i?.priceText ?? '');
  return p.kind === 'ok' && p.minor > 0 ? `£${(p.minor / 100).toFixed(2)}` : '';
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function isDraftEmpty(draft: LabelDraft): boolean {
  if (draft.toolId === 'MIXED') return readMixedState(draft.settings).entries.length === 0;
  if (draft.toolId === 'RUNNER') {
    const s = readRunnerSettings(draft.settings);
    return !s.headline.trim() && !s.support.trim();
  }
  return !draft.items.some(hasContent);
}

function templateSlots(draft: LabelDraft, templateId: string): (LabelItem | undefined)[] {
  const ids = Array.isArray(draft.settings.slots) ? (draft.settings.slots as unknown[]) : draft.items.map((i) => i.id);
  return Array.from({ length: slotCount(templateId) }, (_, k) => draft.items.find((i) => i.id === ids[k]));
}

export function draftSummary(draft: LabelDraft): { title: string; summary: string } {
  const title = toolInfo(draft.toolId)?.title ?? 'Label';
  const named = draft.items.filter(hasContent);
  const names = named.map((i) => i.snapshot.displayName.trim()).filter(Boolean);
  switch (draft.toolId) {
    case 'SEL_STANDARD':
    case 'SEL_PROMO': {
      const labels = named.reduce((n, i) => n + Math.max(1, i.copies), 0);
      return { title, summary: [plural(named.length, 'product') + ` · ${plural(labels, 'label')}`, names.slice(0, 2).join(', ')].filter(Boolean).join(' · ') };
    }
    case 'REDUCED_STICKER':
      return { title, summary: [names[0] ?? 'No product yet', price(named[0])].filter(Boolean).join(' · ') };
    case 'MIXED': {
      const state = readMixedState(draft.settings);
      const layout = MIXED_LAYOUTS.find((l) => l.id === state.layoutId);
      const filled = state.layoutId === 'M00' ? state.entries.length : state.cells.filter(Boolean).length;
      return { title, summary: [layout?.title, plural(filled, 'label'), names[0]].filter(Boolean).join(' · ') };
    }
    case 'RUNNER': {
      const s = readRunnerSettings(draft.settings);
      return { title, summary: [s.headline.trim(), s.support.trim(), `${s.widthMm} × ${s.heightMm} mm`].filter(Boolean).join(' · ') };
    }
    default:
      return { title, summary: names.length ? names.join(', ') : 'No product yet' };
  }
}

/** First label (or first sheet) exactly as its editor renders it; null if it can't be drawn. */
export function draftPreview(draft: LabelDraft): LabelComposition | null {
  try {
    const first = draft.items.find((i) => hasContent(i) && i.lookup !== 'looking_up');
    switch (draft.toolId) {
      case 'SEL_STANDARD':
      case 'SEL_PROMO': {
        if (!first) return null;
        const s = readShelfSettings(draft.toolId === 'SEL_PROMO' ? 'promo' : 'standard', draft.settings);
        return renderShelfLabel(s.design, itemToShelfContent(first), {
          penceSameSize: s.penceSameSize,
          priceOnRight: s.priceOnRight,
          barcodeDownSide: s.barcodeDownSide,
          widthRatio: s.widthRatio,
          colouredStock: s.colouredStock,
        });
      }
      case 'REDUCED_STICKER': {
        const s = readStickerSettings(draft.settings);
        return renderSticker(s.design, itemToStickerContent(first, s.title), {
          widthMm: s.widthMm,
          heightMm: s.heightMm,
          background: s.background,
          textColour: s.textColour,
        });
      }
      case 'MIXED':
        return buildMixedJob(readMixedState(draft.settings), draft.items).pages[0] ?? null;
      case 'RUNNER':
        return renderRunner(readRunnerSettings(draft.settings));
    }
    if (draft.toolId.startsWith('TEMPLATE_')) {
      const id = draft.toolId.slice(9);
      const settings = readTalkerSettings(draft.settings);
      const shared = {
        headline: settings.headline.trim() || undefined,
        listText: settings.listText.trim() || undefined,
        footer: settings.footer.trim() || undefined,
      };
      const slots = templateSlots(draft, id);
      return renderTemplate(id, slots.map((i) => (i || slots.length === 1 ? itemToTalkerContent(i, settings) : null)), shared);
    }
  } catch {
    // A draft from an older/unknown shape still lists; it just has no thumbnail.
  }
  return null;
}
