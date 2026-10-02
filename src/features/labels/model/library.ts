/**
 * Recent / Saved library (spec §10–11), pure. Everything is namespaced per
 * shop + user; saved drafts and print jobs are deep-copied snapshots, so later
 * edits or catalogue refreshes never change them.
 */
import { TEMPLATES } from '../registry/manifest';
import type { LabelComposition } from '../renderer-contract';
import type { LabelDraft } from './draft';

export interface SavedLabel {
  id: string;
  name: string;
  toolId: string;
  draft: LabelDraft;
  createdAt: number;
  updatedAt: number;
}

/** What the platform reported for the export ('dialog' = older records). */
export type JobOutcome = 'printed' | 'print_dialog' | 'shared' | 'dialog';

/** One exported PDF: the exact pages that were produced plus the draft they came from. */
export interface PrintJob {
  id: string;
  toolId: string;
  title: string;
  summary: string;
  createdAt: number;
  output: 'sheet' | 'roll';
  pages: LabelComposition[];
  /** Roll output: pages[0] repeated this many times. Sheets: 1. */
  copies: number;
  outcome: JobOutcome;
  draft: LabelDraft;
}

export const MAX_JOBS = 25;
export const MAX_NAME = 60;

export const draftStorageKey = (userId: string, shopId: string, toolId: string) => `labels.draft.v1.${shopId}.${userId}.${toolId}`;

export function libraryKeys(userId: string, shopId: string) {
  return {
    saved: `labels.saved.v1.${shopId}.${userId}`,
    jobs: `labels.jobs.v1.${shopId}.${userId}`,
    draftPrefix: draftStorageKey(userId, shopId, ''),
  };
}

export const snapshot = <T>(value: T): T => JSON.parse(JSON.stringify(value));

let seq = 0;
export function newLibraryId(prefix: string) {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function validateName(name: string): string | null {
  const n = name.trim();
  if (!n) return 'Give it a name';
  if (n.length > MAX_NAME) return `Keep it to ${MAX_NAME} characters`;
  return null;
}

export function parseList<T extends { id: string }>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string') : [];
  } catch {
    return [];
  }
}

export function addSaved(list: SavedLabel[], name: string, draft: LabelDraft, now = Date.now()): SavedLabel[] {
  const entry: SavedLabel = { id: newLibraryId('sv'), name: name.trim(), toolId: draft.toolId, draft: snapshot(draft), createdAt: now, updatedAt: now };
  return [entry, ...list];
}

export function renameSaved(list: SavedLabel[], id: string, name: string, now = Date.now()): SavedLabel[] {
  return list.map((s) => (s.id === id ? { ...s, name: name.trim(), updatedAt: now } : s));
}

export function duplicateSaved(list: SavedLabel[], id: string, now = Date.now()): SavedLabel[] {
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return list;
  const src = list[i];
  const copy: SavedLabel = {
    ...snapshot(src),
    id: newLibraryId('sv'),
    name: `${src.name} (copy)`.slice(0, MAX_NAME),
    createdAt: now,
    updatedAt: now,
  };
  return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
}

export const deleteSaved = (list: SavedLabel[], id: string) => list.filter((s) => s.id !== id);

export function addJob(list: PrintJob[], job: Omit<PrintJob, 'id' | 'createdAt'>, now = Date.now()): PrintJob[] {
  const entry: PrintJob = { ...snapshot(job), id: newLibraryId('job'), createdAt: now };
  return [entry, ...list].slice(0, MAX_JOBS);
}

/** Editor route + title for a draft's tool ID (null for unknown tools). */
export function toolInfo(toolId: string): { title: string; pathname: string; params?: Record<string, string> } | null {
  switch (toolId) {
    case 'SEL_STANDARD':
      return { title: 'Shelf labels · Standard', pathname: '/(app)/labels/shelf', params: { mode: 'standard' } };
    case 'SEL_PROMO':
      return { title: 'Shelf labels · Promo', pathname: '/(app)/labels/shelf', params: { mode: 'promo' } };
    case 'REDUCED_STICKER':
      return { title: 'Reduced sticker', pathname: '/(app)/labels/reduced' };
    case 'MIXED':
      return { title: 'Mixed sheet', pathname: '/(app)/labels/mixed' };
    case 'RUNNER':
      return { title: 'Shelf liner', pathname: '/(app)/labels/runner' };
  }
  const template = toolId.startsWith('TEMPLATE_') ? TEMPLATES.find((t) => t.id === toolId.slice(9)) : undefined;
  return template ? { title: template.title, pathname: '/(app)/labels/template/[id]', params: { id: template.id } } : null;
}

export function formatWhen(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date(now)) - day(d)) / 86_400_000);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date(now).getFullYear() && { year: 'numeric' }) });
  return `${date}, ${time}`;
}

/** Same content (ignoring timestamps) — reopening an identical snapshot needs no warning. */
export function sameDraftContent(a: LabelDraft, b: LabelDraft) {
  return JSON.stringify([a.items, a.settings]) === JSON.stringify([b.items, b.settings]);
}
