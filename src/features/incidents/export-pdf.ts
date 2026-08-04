import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { formatDateTime } from '@/features/shop-tools/format';

import type { IncidentLog } from './api';

const severityColor: Record<string, string> = {
  LOW: '#2E7D32',
  MEDIUM: '#C7771A',
  HIGH: '#B9382A',
};

/** Renders the loaded incidents to a shareable PDF report. */
export async function exportIncidentsPdf(logs: IncidentLog[], rangeLabel: string): Promise<void> {
  const rows = logs
    .map(
      (log) => `
      <div class="incident">
        <div class="head">
          <span class="severity" style="color:${severityColor[log.severity] ?? '#333'}">${log.severity}</span>
          <span class="date">${formatDateTime(log.incidentAt)}</span>
        </div>
        <p class="desc">${escapeHtml(log.description)}</p>
        <p class="meta">Reported by ${escapeHtml(log.createdByName)}${
          log.updatedByName ? ` · Updated by ${escapeHtml(log.updatedByName)}` : ''
        }</p>
      </div>`,
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 12mm; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #222; font-size: 12px; }
    h1 { font-size: 18px; margin-bottom: 2px; }
    .sub { color: #777; margin-bottom: 16px; }
    .incident { border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
    .head { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .severity { font-weight: 800; letter-spacing: 0.5px; }
    .date { color: #666; }
    .desc { margin: 0 0 6px; line-height: 1.4; }
    .meta { margin: 0; color: #999; font-size: 10px; }
  </style></head><body>
    <h1>Incident Report</h1>
    <div class="sub">${rangeLabel} · ${logs.length} incident${logs.length === 1 ? '' : 's'} · Generated ${new Date().toLocaleString('en-GB')}</div>
    ${rows || '<p>No incidents in this period.</p>'}
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
