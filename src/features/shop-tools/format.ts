/** Shared formatting helpers for shop-tool records. */

export function formatMoney(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num == null || Number.isNaN(num)) return '£0.00';
  return `£${num.toFixed(2)}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return `${formatDate(value)} · ${formatTime(value)}`;
}

/** yyyy-mm-dd for backend date query params. */
export function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** HH:mm for backend time fields. */
export function toTimeParam(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Parse a decimal-string money input; returns null when invalid. */
export function parseMoneyInput(text: string): number | null {
  const cleaned = text.replace(/[£,\s]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Auto-decimal money entry (matches the web admin): digits are treated as
 * pence and the decimal point is placed automatically — "1250" → "12.50".
 */
export function formatMoneyTyping(text: string): string {
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return (parseInt(digits, 10) / 100).toFixed(2);
}
