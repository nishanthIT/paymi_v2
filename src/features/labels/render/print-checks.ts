/** Print-readiness checks shared by every editor: problems block output, never silently dropped. */
import { validateItem, type LabelItem } from '../model/label-item';
import type { LabelComposition } from '../renderer-contract';

export const marksMissingPrice = (c: LabelComposition) =>
  c.nodes.some((n) => n.kind === 'text' && n.previewOnly && n.lines[0] === 'Needs price');

const printsBarcode = (c: LabelComposition) => c.nodes.some((n) => n.kind === 'barcode');

export function itemPrintIssues(item: LabelItem, c: LabelComposition, { checkCopies = true } = {}): string[] {
  const issues: string[] = [];
  if (item.lookup === 'looking_up') issues.push('Still looking up this product');
  const errors = validateItem(item);
  // Designs without a barcode don't need a valid one, and designs without a price (e.g. Circle Badge) don't need a price.
  if (!printsBarcode(c)) delete errors.barcode;
  if (!checkCopies) delete errors.copies;
  if (errors.price && !item.priceText.trim() && !marksMissingPrice(c)) delete errors.price;
  issues.push(...Object.values(errors), ...c.warnings);
  return [...new Set(issues)];
}
