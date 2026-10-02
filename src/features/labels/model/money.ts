/**
 * Money parsing for label prices. Values are integer minor units (pence);
 * text stays editable until validated — no float arithmetic (spec §6, §9).
 */

export type MoneyParse =
  | { kind: 'empty' }
  | { kind: 'ok'; minor: number }
  | { kind: 'error'; message: string };

const MONEY_RE = /^(\d{1,5})(?:\.(\d{1,2}))?$/;

export function parseMoneyText(text: string): MoneyParse {
  const cleaned = text.trim().replace(/^£/, '').replace(/,/g, '').trim();
  if (!cleaned) return { kind: 'empty' };
  const match = MONEY_RE.exec(cleaned);
  if (!match) return { kind: 'error', message: 'Enter an amount like 8.75' };
  const pounds = Number(match[1]);
  const pence = Number((match[2] ?? '').padEnd(2, '0'));
  return { kind: 'ok', minor: pounds * 100 + pence };
}

export function formatMinor(minor: number): string {
  const pounds = Math.floor(minor / 100);
  const pence = String(minor % 100).padStart(2, '0');
  return `${pounds}.${pence}`;
}

/**
 * Catalogue RRP (Prisma Decimal → string/number) to pence. Returns null when
 * absent, non-positive, or not representable exactly in whole pence.
 */
export function catalogueRrpToMinor(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;
  const fraction = match[2] ?? '';
  // Reject values like 1.155 rather than silently rounding a price.
  if (fraction.length > 2 && /[1-9]/.test(fraction.slice(2))) return null;
  const minor = Number(match[1]) * 100 + Number(fraction.slice(0, 2).padEnd(2, '0'));
  return minor > 0 ? minor : null;
}
