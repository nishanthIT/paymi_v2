/**
 * Mixed-sheet state (pure). Every filled label is an entry with a fixed
 * physical size; fixed layouts map cells → entry IDs. Entries are never
 * dropped by a layout change: ones that don't fit the new cells stay in an
 * unplaced queue until the owner places or removes them.
 */
import { APP_MARKET } from '../registry/catalogue-meta';
import { TEMPLATES } from '../registry/manifest';
import { MIXED_CELLS } from '../registry/mixed-geometry';
import { LABEL_SIZES, type LabelSizeId } from '../registry/sizes';

export interface MixedEntry {
  id: string;
  sizeId: LabelSizeId;
  templateId?: string;
  itemId?: string;
  headline: string;
  listText: string;
  footer: string;
  /** Custom mode only; a fixed cell always holds one label. */
  copies: number;
}

export interface MixedState {
  layoutId: string;
  entries: MixedEntry[];
  /** Fixed layouts: one entry ID per cell, '' when empty. Unused for Custom. */
  cells: string[];
}

export const isCustomLayout = (layoutId: string) => layoutId === 'M00';

export function cellSizes(layoutId: string): LabelSizeId[] {
  return (MIXED_CELLS[layoutId] ?? []).map((c) => c.sizeId);
}

let seq = 0;
export function newEntryId() {
  seq += 1;
  return `mx_${Date.now().toString(36)}_${seq.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function newEntry(sizeId: LabelSizeId, templateId?: string): MixedEntry {
  return { id: newEntryId(), sizeId, templateId, headline: '', listText: '', footer: '', copies: 1 };
}

const isSize = (v: unknown): v is LabelSizeId => typeof v === 'string' && v in LABEL_SIZES;

/** Tolerant read of persisted settings; drops only structurally broken data. */
export function readMixedState(stored: Record<string, unknown>): MixedState {
  const layoutId = typeof stored.layoutId === 'string' && stored.layoutId in MIXED_CELLS ? stored.layoutId : '';
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const entries: MixedEntry[] = (Array.isArray(stored.entries) ? (stored.entries as Record<string, unknown>[]) : [])
    .filter((e) => !!e && typeof e.id === 'string' && isSize(e.sizeId))
    .map((e) => {
      const sizeId = e.sizeId as LabelSizeId;
      const templateId = typeof e.templateId === 'string' && isCompatible(e.templateId, sizeId) ? e.templateId : undefined;
      const copies = Number.isInteger(e.copies) && (e.copies as number) >= 1 ? (e.copies as number) : 1;
      return {
        id: e.id as string,
        sizeId,
        templateId,
        itemId: typeof e.itemId === 'string' ? e.itemId : undefined,
        headline: str(e.headline),
        listText: str(e.listText),
        footer: str(e.footer),
        copies,
      };
    });
  const ids = new Set(entries.map((e) => e.id));
  const sizes = cellSizes(layoutId);
  const raw = Array.isArray(stored.cells) ? stored.cells : [];
  const cells = sizes.map((size, i) => {
    const id = raw[i];
    const entry = typeof id === 'string' && ids.has(id) ? entries.find((e) => e.id === id) : undefined;
    return entry && entry.sizeId === size ? entry.id : '';
  });
  return { layoutId, entries, cells };
}

/** Designs whose physical size is exactly the cell's. Show all only lifts the market filter. */
export function compatibleTemplates(sizeId: LabelSizeId, showAll = false) {
  return TEMPLATES.filter((t) => t.sizeId === sizeId && (showAll || t.markets.includes(APP_MARKET)));
}

export function isCompatible(templateId: string, sizeId: LabelSizeId) {
  return TEMPLATES.find((t) => t.id === templateId)?.sizeId === sizeId;
}

export function unplacedEntries(state: MixedState): MixedEntry[] {
  if (isCustomLayout(state.layoutId)) return [];
  const placed = new Set(state.cells.filter(Boolean));
  return state.entries.filter((e) => !placed.has(e.id));
}

/**
 * Switch layout, keeping work: entries currently in cells (in cell order)
 * then the unplaced queue fill the new cells by exact size.
 */
export function changeLayout(state: MixedState, layoutId: string): MixedState {
  const byId = new Map(state.entries.map((e) => [e.id, e]));
  const priority = [
    ...state.cells.filter(Boolean).map((id) => byId.get(id)!),
    ...state.entries.filter((e) => !state.cells.includes(e.id)),
  ];
  if (isCustomLayout(layoutId)) return { layoutId, entries: priority, cells: [] };
  const used = new Set<string>();
  const cells = cellSizes(layoutId).map((size) => {
    const match = priority.find((e) => !used.has(e.id) && e.sizeId === size);
    if (!match) return '';
    used.add(match.id);
    return match.id;
  });
  return { layoutId, entries: priority, cells };
}

/** Put an entry in a cell; a previous occupant moves to the unplaced queue. */
export function placeInCell(state: MixedState, entryId: string, cellIndex: number): MixedState {
  const entry = state.entries.find((e) => e.id === entryId);
  const size = cellSizes(state.layoutId)[cellIndex];
  if (!entry || !size || entry.sizeId !== size) return state;
  const cells = state.cells.map((id, i) => (i === cellIndex ? entryId : id === entryId ? '' : id));
  return { ...state, cells };
}

export function addEntry(state: MixedState, entry: MixedEntry, cellIndex?: number): MixedState {
  const next = { ...state, entries: [...state.entries, entry] };
  return cellIndex == null ? next : placeInCell(next, entry.id, cellIndex);
}

export function updateEntry(state: MixedState, entryId: string, patch: Partial<Omit<MixedEntry, 'id' | 'sizeId'>>): MixedState {
  return { ...state, entries: state.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) };
}

export function removeEntry(state: MixedState, entryId: string): MixedState {
  return {
    ...state,
    entries: state.entries.filter((e) => e.id !== entryId),
    cells: state.cells.map((id) => (id === entryId ? '' : id)),
  };
}

export function moveEntry(state: MixedState, entryId: string, delta: -1 | 1): MixedState {
  const i = state.entries.findIndex((e) => e.id === entryId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.entries.length) return state;
  const entries = [...state.entries];
  [entries[i], entries[j]] = [entries[j], entries[i]];
  return { ...state, entries };
}

/** Empty cells that could take a copy of this entry (same physical size). */
export function compatibleEmptyCells(state: MixedState, entryId: string): number[] {
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry) return [];
  return cellSizes(state.layoutId).flatMap((size, i) => (size === entry.sizeId && !state.cells[i] ? [i] : []));
}

/** True when an entry holds nothing worth keeping (safe to discard on back). */
export function isBlankEntry(entry: MixedEntry) {
  return !entry.itemId && !entry.headline.trim() && !entry.listText.trim() && !entry.footer.trim();
}
