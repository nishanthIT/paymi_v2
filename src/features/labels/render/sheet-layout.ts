/**
 * Grid-sheet composition: expands copies into label instances, applies the
 * 1-based Start at cell and paginates overflow onto further sheets (spec §5).
 */
import { STANDARD_SHELF_SHEET } from '../registry/sizes';

export type GridSheet = typeof STANDARD_SHELF_SHEET;

export interface SheetInstance {
  itemId: string;
  copy: number;
}

/** Page cells are 1-based positions; null = empty (receives no ink at all). */
export type SheetPage = (SheetInstance | null)[];

export function cellsPerSheet(sheet: GridSheet) {
  return sheet.columns * sheet.rows;
}

export function expandInstances(items: { id: string; copies: number }[]): SheetInstance[] {
  const instances: SheetInstance[] = [];
  for (const item of items) {
    for (let copy = 1; copy <= Math.max(0, Math.floor(item.copies)); copy++) {
      instances.push({ itemId: item.id, copy });
    }
  }
  return instances;
}

export function clampStartAt(startAt: number, sheet: GridSheet) {
  const cells = cellsPerSheet(sheet);
  return Math.min(cells, Math.max(1, Math.floor(startAt) || 1));
}

/** Fill left-to-right, top-to-bottom from startAt; later sheets start at cell 1. */
export function paginate(instances: SheetInstance[], startAt: number, sheet: GridSheet): SheetPage[] {
  const cells = cellsPerSheet(sheet);
  const pages: SheetPage[] = [];
  let page: SheetPage = Array.from({ length: cells }, () => null);
  let cursor = clampStartAt(startAt, sheet) - 1;
  for (const instance of instances) {
    if (cursor >= cells) {
      pages.push(page);
      page = Array.from({ length: cells }, () => null);
      cursor = 0;
    }
    page[cursor] = instance;
    cursor += 1;
  }
  pages.push(page);
  return pages;
}

/** Physical position of a 1-based cell on the page, in mm from the top-left. */
export function cellRect(sheet: GridSheet, cellNumber: number) {
  const index = cellNumber - 1;
  const row = Math.floor(index / sheet.columns);
  const col = index % sheet.columns;
  return {
    row: row + 1,
    col: col + 1,
    xMm: sheet.marginLeftMm + col * (sheet.cell.widthMm + sheet.gutterXMm),
    yMm: sheet.marginTopMm + row * (sheet.cell.heightMm + sheet.gutterYMm),
    wMm: sheet.cell.widthMm,
    hMm: sheet.cell.heightMm,
  };
}
