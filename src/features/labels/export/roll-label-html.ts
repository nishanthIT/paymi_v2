/** Roll-label print HTML: one sticker per page, page = physical label size, no margins. */
import type { LabelComposition } from '../renderer-contract';
import { compositionToSvg } from '../render/composition-svg';

export function buildRollLabelHtml(composition: LabelComposition, copies: number): string {
  const { widthMm: w, heightMm: h } = composition;
  const svg = compositionToSvg(composition);
  const pages = Array.from({ length: copies }, () => `<div class="page">${svg}</div>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .page { width: ${w}mm; height: ${h}mm; overflow: hidden; page-break-after: always; break-after: page; }
    .page:last-child { page-break-after: auto; break-after: auto; }
  </style></head><body>${pages}</body></html>`;
}
