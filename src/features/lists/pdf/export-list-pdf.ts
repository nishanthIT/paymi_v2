import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { ListDetails } from '../types';
import { buildListPdfHtml, type PdfExportOptions } from './build-list-pdf-html';

/** Generates the A4 picking-sheet PDF and opens the system share dialog. */
export async function exportListPdf(list: ListDetails, options: PdfExportOptions): Promise<void> {
  const html = buildListPdfHtml(list, options);

  const { uri } = await Print.printToFileAsync({
    html,
    // A4 in points (72dpi): 595 × 842.
    width: 595,
    height: 842,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `${list.name || 'Shopping list'} — picking sheet`,
  });
}
