/**
 * Label output routes (spec §9). Every route prints the same true-size HTML
 * pages; nothing is ever fitted to the paper.
 * - Web: the label document prints from a hidden iframe (browser dialog, incl. Save as PDF).
 * - Native: a PDF at the exact page size, then the system print dialog or the share sheet.
 */
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { mmToPt } from '../registry/sizes';
import type { LabelComposition } from '../renderer-contract';
import { buildSheetHtml } from './sheet-html';

export type OutputRoute = 'print' | 'share';

/** Only what the platform can actually tell us. */
export type OutputStatus =
  | 'printed' // iOS confirmed the job completed
  | 'print_dialog' // dialog opened; Android/web don't report completion
  | 'shared' // share sheet opened with the PDF
  | 'cancelled';

export interface OutputJob {
  /** One composition per physical page (roll labels: one per sticker). */
  pages: LabelComposition[];
  title: string;
}

export const canShareFiles = () => Platform.OS !== 'web';

/** Native WebViews can't read app-sandbox file:// photos from HTML; embed them. */
async function inlineLocalImages(pages: LabelComposition[]): Promise<LabelComposition[]> {
  const cache = new Map<string, string>();
  const out: LabelComposition[] = [];
  for (const page of pages) {
    const nodes = [];
    for (const n of page.nodes) {
      if (n.kind === 'image' && n.uri.startsWith('file:')) {
        if (!cache.has(n.uri)) {
          try {
            const ext = n.uri.split('.').pop()?.toLowerCase();
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            cache.set(n.uri, `data:${mime};base64,${await new File(n.uri).base64()}`);
          } catch {
            cache.set(n.uri, n.uri);
          }
        }
        nodes.push({ ...n, uri: cache.get(n.uri)! });
      } else nodes.push(n);
    }
    out.push({ ...page, nodes });
  }
  return out;
}

function printHtmlOnWeb(html: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.title = title;
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
    const cleanup = () => setTimeout(() => frame.remove(), 1000);
    // The iframe's load event waits for the SVG product photos, so they're in the printout.
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) {
        frame.remove();
        return reject(new Error('The browser blocked printing'));
      }
      win.addEventListener('afterprint', cleanup, { once: true });
      win.focus();
      win.print();
      resolve();
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

export async function outputLabels(job: OutputJob, route: OutputRoute): Promise<OutputStatus> {
  if (!job.pages.length) throw new Error('Nothing to print');
  if (Platform.OS === 'web') {
    await printHtmlOnWeb(buildSheetHtml(job.pages), job.title);
    return 'print_dialog';
  }
  const pages = await inlineLocalImages(job.pages);
  const { widthMm, heightMm } = pages[0];
  const { uri } = await Print.printToFileAsync({
    html: buildSheetHtml(pages),
    width: mmToPt(widthMm),
    height: mmToPt(heightMm),
    margins: { left: 0, right: 0, top: 0, bottom: 0 },
  });
  if (route === 'share' && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: job.title });
    return 'shared';
  }
  try {
    await Print.printAsync({ uri });
  } catch (e: any) {
    if (/did not complete|cancel/i.test(String(e?.message ?? e))) return 'cancelled';
    throw e;
  }
  return Platform.OS === 'ios' ? 'printed' : 'print_dialog';
}

export function outputMessage(status: OutputStatus): { text: string; type: 'success' | 'info' } {
  switch (status) {
    case 'printed':
      return { text: 'Sent to the printer', type: 'success' };
    case 'shared':
      return { text: 'PDF ready — choose where to save or print it', type: 'success' };
    case 'cancelled':
      return { text: 'Printing cancelled — nothing was sent', type: 'info' };
    default:
      return {
        text: Platform.OS === 'web' ? 'Print dialog opened — print at 100% scale, or choose Save as PDF' : 'Print dialog opened — print at 100% scale',
        type: 'info',
      };
  }
}
