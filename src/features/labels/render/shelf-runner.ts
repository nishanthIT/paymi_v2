/**
 * Shelf liner / runner (spec §11, inferred editor): a message-only strip at an
 * explicit physical size, printed true-size on A4 landscape sheets. No product.
 */
import { LABEL_SIZES } from '../registry/sizes';
import type { CompositionNode, LabelComposition } from '../renderer-contract';
import { translateNodes } from './mixed-sheet';
import { fitText, INK } from './shelf-label';

export type RunnerBackground = 'red' | 'yellow' | 'black' | 'white';

export const RUNNER_COLOURS: Record<RunnerBackground, { fill: string; ink: string; label: string }> = {
  red: { fill: '#F44236', ink: '#FFFFFF', label: 'Red' },
  yellow: { fill: '#FFD60A', ink: INK, label: 'Yellow' },
  black: { fill: '#111111', ink: '#FFFFFF', label: 'Black' },
  white: { fill: '#FFFFFF', ink: '#F44236', label: 'White' },
};

export interface RunnerPreset {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

// Assumption: strips run the A4 landscape length less 5 mm each end, so
// printers with non-printable edges don't clip them; join strips for longer runs.
export const RUNNER_PRESETS: RunnerPreset[] = [
  { id: 'A4_39', label: 'A4 length · 287 × 39 mm', widthMm: 287, heightMm: 39 },
  { id: 'A4_30', label: 'A4 length · 287 × 30 mm', widthMm: 287, heightMm: 30 },
];
export const RUNNER_BOUNDS = { minW: 100, maxW: 287, minH: 20, maxH: 60 };
export const RUNNER_SHEET = { page: LABEL_SIZES.A4_LANDSCAPE, marginMm: 5, gapMm: 4 };

export interface RunnerSettings {
  presetId: string;
  widthMm: number;
  heightMm: number;
  headline: string;
  support: string;
  background: RunnerBackground;
  repeat: boolean;
  copies: number;
}

export function defaultRunnerSettings(): RunnerSettings {
  const p = RUNNER_PRESETS[0];
  return { presetId: p.id, widthMm: p.widthMm, heightMm: p.heightMm, headline: '', support: '', background: 'red', repeat: true, copies: 1 };
}

export function readRunnerSettings(stored: Record<string, unknown>): RunnerSettings {
  const d = defaultRunnerSettings();
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    presetId: str(stored.presetId) || d.presetId,
    widthMm: num(stored.widthMm, d.widthMm),
    heightMm: num(stored.heightMm, d.heightMm),
    headline: str(stored.headline),
    support: str(stored.support),
    background: typeof stored.background === 'string' && stored.background in RUNNER_COLOURS ? (stored.background as RunnerBackground) : d.background,
    repeat: typeof stored.repeat === 'boolean' ? stored.repeat : d.repeat,
    copies: Number.isInteger(stored.copies) && (stored.copies as number) >= 1 ? (stored.copies as number) : 1,
  };
}

export function validateRunnerSize(widthMm: number, heightMm: number): string | null {
  const b = RUNNER_BOUNDS;
  if (!(widthMm >= b.minW && widthMm <= b.maxW)) return `Length must be ${b.minW}–${b.maxW} mm to print on A4 landscape`;
  if (!(heightMm >= b.minH && heightMm <= b.maxH)) return `Height must be ${b.minH}–${b.maxH} mm`;
  return null;
}

// Heavy uppercase glyphs run wider than the shared 0.6 em estimate.
const HEAVY_W = 0.72;

export function renderRunner(s: RunnerSettings): LabelComposition {
  const W = s.widthMm;
  const H = s.heightMm;
  const colours = RUNNER_COLOURS[s.background];
  const nodes: CompositionNode[] = [];
  const warnings: string[] = [];
  if (s.background !== 'white') nodes.push({ kind: 'rect', xMm: 0, yMm: 0, wMm: W, hMm: H, fill: colours.fill });

  const headline = s.headline.trim().toUpperCase();
  const support = s.support.trim().toUpperCase();
  const pad = H * 0.25;
  const avail = W - pad * 2;
  if (!headline) {
    nodes.push({
      kind: 'text',
      xMm: pad,
      yMm: H / 2 - H * 0.14,
      wMm: avail,
      lines: ['Add your message'],
      fontMm: H * 0.24,
      lineHeightMm: H * 0.28,
      weight: '700',
      align: 'center',
      colour: colours.ink,
      previewOnly: true,
    });
    return { widthMm: W, heightMm: H, nodes, warnings: ['Add a headline for the strip'] };
  }

  // One message unit = headline + supporting text; repeated units are sized smaller.
  const unitTarget = s.repeat ? Math.min(avail, H * 3) : avail;
  const gap = support ? H * 0.22 : 0;
  const headShare = support ? 0.58 : 1;
  const headFont = Math.min(H * 0.62, (unitTarget * headShare) / (headline.length * HEAVY_W));
  if (headFont < H * 0.3) warnings.push('Headline is too long for this strip — shorten it or use a longer strip');
  const headW = headline.length * headFont * HEAVY_W;
  let sup: { lines: string[]; fontMm: number; fits: boolean } = { lines: [], fontMm: 0, fits: true };
  if (support) {
    // fitText measures at 0.6 em; narrow its width so the fit holds at the heavy 0.72 em.
    sup = fitText(support, Math.max(10, unitTarget - headW - gap) * (0.6 / HEAVY_W), 2, H * 0.26, Math.max(3, H * 0.12));
    if (!sup.fits) warnings.push('Supporting text is too long for this strip — shorten it');
  }
  const supW = sup.lines.length ? Math.max(...sup.lines.map((l) => l.length * sup.fontMm * HEAVY_W)) : 0;
  const unitW = headW + gap + supW;
  const spacing = H * 0.6;
  const count = s.repeat ? Math.max(1, Math.floor((avail + spacing) / (unitW + spacing))) : 1;
  const step = (W - count * unitW) / (count + 1);

  for (let k = 0; k < count; k++) {
    const x = step + k * (unitW + step);
    nodes.push({
      kind: 'text',
      xMm: x,
      yMm: (H - headFont * 1.1) / 2,
      wMm: headW,
      lines: [headline],
      fontMm: headFont,
      lineHeightMm: headFont * 1.1,
      weight: '800',
      align: 'left',
      colour: colours.ink,
    });
    if (sup.lines.length) {
      const lh = sup.fontMm * 1.12;
      nodes.push({
        kind: 'text',
        xMm: x + headW + gap,
        yMm: (H - sup.lines.length * lh) / 2,
        wMm: supW + 0.5,
        lines: sup.lines,
        fontMm: sup.fontMm,
        lineHeightMm: lh,
        weight: '700',
        align: 'left',
        colour: colours.ink,
      });
    }
  }
  return { widthMm: W, heightMm: H, nodes, warnings };
}

export function runnerStripsPerPage(heightMm: number) {
  const { page, marginMm, gapMm } = RUNNER_SHEET;
  return Math.max(1, Math.floor((page.heightMm - 2 * marginMm + gapMm) / (heightMm + gapMm)));
}

/** True-size strips stacked on A4 landscape pages; copies overflow onto new pages. */
export function composeRunnerPages(strip: LabelComposition, copies: number): LabelComposition[] {
  const { page, marginMm, gapMm } = RUNNER_SHEET;
  const perPage = runnerStripsPerPage(strip.heightMm);
  const pages: LabelComposition[] = [];
  for (let start = 0; start < copies; start += perPage) {
    const n = Math.min(perPage, copies - start);
    const x = (page.widthMm - strip.widthMm) / 2;
    const nodes: CompositionNode[] = [];
    for (let i = 0; i < n; i++) {
      const y = marginMm + i * (strip.heightMm + gapMm);
      nodes.push(...translateNodes(strip.nodes, x, y));
      // Preview-only cut outline, so white strips are visible; never printed.
      nodes.push({ kind: 'rect', xMm: x, yMm: y, wMm: strip.widthMm, hMm: strip.heightMm, stroke: '#A9C4EC', previewOnly: true });
    }
    pages.push({ widthMm: page.widthMm, heightMm: page.heightMm, nodes, warnings: strip.warnings });
  }
  return pages;
}
