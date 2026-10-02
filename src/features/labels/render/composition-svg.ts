/**
 * Composition → SVG (mm user units). Used for PDF output and dev verification.
 * previewOnly nodes (simulated stock, placeholders, markers) are never emitted.
 */
import type { CompositionNode, LabelComposition } from '../renderer-contract';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = 'Arial, Helvetica, sans-serif';

function anchorX(n: { xMm: number; wMm: number; align?: string }) {
  if (n.align === 'center') return { x: n.xMm + n.wMm / 2, anchor: 'middle' };
  if (n.align === 'right') return { x: n.xMm + n.wMm, anchor: 'end' };
  return { x: n.xMm, anchor: 'start' };
}

export function nodeToSvg(n: CompositionNode): string {
  switch (n.kind) {
    case 'rect':
      return `<rect x="${n.xMm}" y="${n.yMm}" width="${n.wMm}" height="${n.hMm}"${n.radiusMm ? ` rx="${n.radiusMm}"` : ''} fill="${n.fill ?? 'none'}"${n.stroke ? ` stroke="${n.stroke}" stroke-width="0.2"` : ''}/>`;
    case 'text': {
      const { x, anchor } = anchorX(n);
      const rot = n.rotateDeg
        ? ` transform="rotate(${n.rotateDeg} ${n.xMm + n.wMm / 2} ${n.yMm + n.lineHeightMm / 2})"`
        : '';
      return n.lines
        .map(
          (line, i) =>
            `<text x="${x}" y="${n.yMm + i * n.lineHeightMm + n.fontMm * 0.9}" font-size="${n.fontMm}" font-weight="${n.weight ?? 700}"${n.italic ? ' font-style="italic"' : ''} text-anchor="${anchor}" fill="${n.colour ?? '#111'}"${n.strike ? ' text-decoration="line-through"' : n.underline ? ' text-decoration="underline"' : ''}${rot}>${esc(line)}</text>`,
        )
        .join('');
    }
    case 'price': {
      const { x, anchor } = anchorX(n);
      const minor = n.minor
        ? `<tspan font-size="${n.fontMm * n.minorScale}" dy="${-n.fontMm * 0.33}">${esc(n.minor)}</tspan>`
        : '';
      return `<text x="${x}" y="${n.yMm + n.fontMm * 0.95}" font-size="${n.fontMm}" font-weight="800" text-anchor="${anchor}" fill="${n.colour ?? '#111'}">${esc(n.major)}${minor}</text>`;
    }
    case 'barcode': {
      const count = n.modules.length;
      let bars = '';
      let start = -1;
      for (let i = 0; i <= count; i++) {
        const bar = n.modules[i] === '1';
        if (bar && start < 0) start = i;
        if (!bar && start >= 0) {
          bars += n.rotated
            ? `<rect x="${n.xMm}" y="${n.yMm + (start * n.hMm) / count}" width="${n.wMm}" height="${((i - start) * n.hMm) / count}"/>`
            : `<rect x="${n.xMm + (start * n.wMm) / count}" y="${n.yMm}" width="${((i - start) * n.wMm) / count}" height="${n.hMm}"/>`;
          start = -1;
        }
      }
      return `<g fill="#000" shape-rendering="crispEdges">${bars}</g>`;
    }
    case 'image':
      return `<image href="${esc(n.uri)}" x="${n.xMm}" y="${n.yMm}" width="${n.wMm}" height="${n.hMm}" preserveAspectRatio="xMidYMid meet"/>`;
  }
}

/** SVG sized in real millimetres (for PDF pages at 100 % scale). */
export function compositionToSvg(c: LabelComposition, options: { includePreviewOnly?: boolean } = {}): string {
  const body = c.nodes
    .filter((n) => options.includePreviewOnly || !('previewOnly' in n && n.previewOnly))
    .map(nodeToSvg)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${c.widthMm}mm" height="${c.heightMm}mm" viewBox="0 0 ${c.widthMm} ${c.heightMm}" style="font-family:${FONT};display:block">${body}</svg>`;
}
