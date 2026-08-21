/**
 * Space- and case-insensitive search helpers used across the app so
 * "Coca Cola", "CocaCola" and "coca  cola" all match the same items.
 */

/** Lowercases and strips all whitespace for comparison. */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, '');
}

/** True when any of the fields contains the term, ignoring spaces and case. */
export function matchesSearch(term: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = normalizeSearchText(term);
  if (!needle) return true;
  return fields.some((field) => normalizeSearchText(field).includes(needle));
}
