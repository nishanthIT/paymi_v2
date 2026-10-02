/**
 * Label draft state (spec §10). Pure reducer so ordering/concurrency rules
 * are testable: every scan becomes its own row immediately, and lookup
 * results are applied by row ID — never by barcode or position.
 */
import {
  applyLookupError,
  applyLookupResult,
  createCustomItem,
  createPendingItem,
  type CatalogueLookupResult,
  type LabelItem,
} from './label-item';

export const DRAFT_VERSION = 1;

export interface LabelDraft {
  version: number;
  toolId: string;
  items: LabelItem[];
  /** Tool-specific settings (sheet, design, options) — owned by later batches. */
  settings: Record<string, unknown>;
  updatedAt: number;
}

export type DraftAction =
  | { type: 'hydrate'; draft: LabelDraft }
  | { type: 'scan'; item: LabelItem }
  | { type: 'addCustom'; item: LabelItem }
  | { type: 'lookupResolved'; itemId: string; result: CatalogueLookupResult | null }
  | { type: 'lookupFailed'; itemId: string; message: string }
  | { type: 'update'; itemId: string; update: (item: LabelItem) => LabelItem }
  | { type: 'remove'; itemId: string }
  | { type: 'setSettings'; settings: Record<string, unknown> }
  | { type: 'clear' };

export function emptyDraft(toolId: string, now = Date.now()): LabelDraft {
  return { version: DRAFT_VERSION, toolId, items: [], settings: {}, updatedAt: now };
}

function mapItem(draft: LabelDraft, itemId: string, fn: (item: LabelItem) => LabelItem): LabelDraft {
  let changed = false;
  const items = draft.items.map((item) => {
    if (item.id !== itemId) return item;
    changed = true;
    return fn(item);
  });
  // A late response for a removed row is dropped rather than resurrecting it.
  return changed ? { ...draft, items, updatedAt: Date.now() } : draft;
}

export function draftReducer(draft: LabelDraft, action: DraftAction): LabelDraft {
  switch (action.type) {
    case 'hydrate':
      return action.draft;
    case 'scan':
    case 'addCustom':
      return { ...draft, items: [...draft.items, action.item], updatedAt: Date.now() };
    case 'lookupResolved':
      return mapItem(draft, action.itemId, (item) => applyLookupResult(item, action.result));
    case 'lookupFailed':
      return mapItem(draft, action.itemId, (item) => applyLookupError(item, action.message));
    case 'update':
      return mapItem(draft, action.itemId, action.update);
    case 'remove':
      return { ...draft, items: draft.items.filter((i) => i.id !== action.itemId), updatedAt: Date.now() };
    case 'setSettings':
      return { ...draft, settings: { ...draft.settings, ...action.settings }, updatedAt: Date.now() };
    case 'clear':
      return emptyDraft(draft.toolId);
    default:
      return draft;
  }
}

/** Printed label instances = sum of copies (extra facings count). */
export function labelInstanceCount(draft: LabelDraft): number {
  return draft.items.reduce((sum, item) => sum + Math.max(0, item.copies), 0);
}

export { createCustomItem, createPendingItem };

/** Validate a persisted blob before trusting it. */
export function parseStoredDraft(raw: string | null, toolId: string): LabelDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LabelDraft;
    if (parsed?.version !== DRAFT_VERSION || parsed.toolId !== toolId || !Array.isArray(parsed.items)) {
      return null;
    }
    // A lookup interrupted by an app restart is retried, not left spinning forever.
    const items = parsed.items.map((item) =>
      item.lookup === 'looking_up' ? { ...item, lookup: 'error' as const, lookupError: 'Lookup was interrupted — tap to retry' } : item,
    );
    return { ...parsed, items };
  } catch {
    return null;
  }
}
