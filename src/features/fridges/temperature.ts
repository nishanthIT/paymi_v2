/** Signed decimal input; an empty or unfinished value is never treated as zero. */
export function parseTemperature(value: string): number | null {
  const text = value.trim().replace(/\u2212/g, '-').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Keep numeric-keyboard input separate from its explicit sign control. */
export function temperatureEntry(value: string, negative: boolean): { magnitude: string; negative: boolean; text: string } {
  const normalized = value.trim().replace(/\u2212/g, '-').replace(',', '.');
  const sign = normalized.startsWith('-') ? true : normalized.startsWith('+') ? false : negative;
  const magnitude = normalized.replace(/^[+-]/, '');
  return { magnitude, negative: sign, text: `${sign ? '-' : ''}${magnitude}` };
}
