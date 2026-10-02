/**
 * Shared renderer contract (spec §9). One deterministic renderer per template ID
 * produces the identical composition for thumbnail, preview, PDF and printer
 * conversion. Implementations arrive with their batches; the types are fixed now
 * so every consumer builds against the same shape.
 */
import type { LabelSizeId } from './registry/sizes';

/** Immutable product/price snapshot captured into a label item (spec §10). */
export interface ProductSnapshot {
  catalogueProductId?: string;
  /** Original scanned string — leading zeroes preserved. */
  barcode?: string;
  barcodeSymbology?: 'EAN13' | 'UPCA' | 'EAN8' | 'CODE128';
  displayName: string;
  brand?: string;
  packSize?: string;
  imageUri?: string;
  /** Source RRP kept separately from the editable final price. */
  sourceRrp?: { amountMinor: number; currency: string };
}

/** Money as integer minor units — never floats (spec §9). */
export interface Money {
  amountMinor: number;
  currency: 'GBP';
}

export interface LabelPricing {
  /** Final selling price; undefined = not yet entered (blocks export, never prints as 0). */
  price?: Money;
  priceEdited: boolean;
  ownerEnteredRrp?: Money;
  /** Separately confirmed previous selling price — never auto-derived from RRP. */
  wasPrice?: Money;
  offer?: { quantity: number; totalPrice: Money };
}

export interface LabelStyleOptions {
  penceSameSize?: boolean;
  printDate?: boolean;
  priceOnRight?: boolean;
  barcodeDownSide?: boolean;
  background?: 'none' | 'white' | 'yellow' | 'red';
  textColour?: 'black' | 'red';
  /** 0–1 usable content width inside the physical cell (shelf sheets). */
  contentWidthRatio?: number;
}

export interface RenderRequest {
  templateId: string;
  sizeId: LabelSizeId;
  products: ProductSnapshot[];
  pricing: LabelPricing[];
  style: LabelStyleOptions;
  /** Date captured once per export job when printDate is enabled. */
  jobDate?: string;
  /** Fixture renders are preview-only and must never reach a production job. */
  isFixture?: boolean;
}

/** A renderer returns a size-independent vector composition. */
export interface LabelRenderer {
  templateId: string;
  render(request: RenderRequest): LabelComposition;
}

/** Minimal composition model consumed by preview (RN views), PDF and raster output. */
export type CompositionNode =
  | {
      kind: 'rect';
      xMm: number;
      yMm: number;
      wMm: number;
      hMm: number;
      fill?: string;
      stroke?: string;
      radiusMm?: number;
      /** Simulates pre-coloured stock / preview hint; never inked on export. */
      previewOnly?: boolean;
    }
  | {
      kind: 'text';
      xMm: number;
      yMm: number;
      wMm: number;
      /** Pre-wrapped lines (renderer controls line breaks). */
      lines: string[];
      fontMm: number;
      lineHeightMm: number;
      weight?: '400' | '600' | '700' | '800';
      align?: 'left' | 'center' | 'right';
      colour?: string;
      strike?: boolean;
      underline?: boolean;
      italic?: boolean;
      /** Rotation about the text box centre (used for upright barcode digits). */
      rotateDeg?: number;
      previewOnly?: boolean;
    }
  | {
      kind: 'price';
      xMm: number;
      yMm: number;
      wMm: number;
      hMm: number;
      /** "£8." and "75" — pence drawn raised & smaller unless flat. */
      major: string;
      minor: string;
      flat: boolean;
      fontMm: number;
      minorScale: number;
      align: 'left' | 'center' | 'right';
      colour?: string;
    }
  | {
      kind: 'barcode';
      xMm: number;
      yMm: number;
      wMm: number;
      hMm: number;
      value: string;
      symbology: NonNullable<ProductSnapshot['barcodeSymbology']>;
      /** Encoded modules ('1' = bar) incl. quiet zones — identical for every output. */
      modules: string;
      /** Upright: modules run top→bottom, bars are horizontal. */
      rotated?: boolean;
    }
  | { kind: 'image'; xMm: number; yMm: number; wMm: number; hMm: number; uri: string };

export interface LabelComposition {
  widthMm: number;
  heightMm: number;
  nodes: CompositionNode[];
  /** Layout problems that must be fixed before output (e.g. text cannot fit). */
  warnings: string[];
}
