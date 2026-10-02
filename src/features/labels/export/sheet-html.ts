/** Sheet print HTML: one page per composed sheet at its exact size, no margins. */
import type { LabelComposition } from '../renderer-contract';
import { compositionToSvg } from '../render/composition-svg';

export function buildSheetHtml(pages: LabelComposition[]): string {
  if (!pages.length) throw new Error('Nothing to print');
  const { widthMm: w, heightMm: h } = pages[0];
  const body = pages.map((p) => `<div class="page">${compositionToSvg(p)}</div>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .page { width: ${w}mm; height: ${h}mm; overflow: hidden; page-break-after: always; break-after: page; }
    .page:last-child { page-break-after: auto; break-after: auto; }
  </style></head><body>${body}</body></html>`;
}
