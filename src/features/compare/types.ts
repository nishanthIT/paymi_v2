/**
 * Wire types for `GET /api/products/:id/compare`. Everything the client needs
 * to build the ranked comparison lives on the response — no follow-up calls.
 */

export interface CompareProduct {
  id: string;
  title: string;
  barcode: string | null;
  img: unknown;
  category: string | null;
  packetSize: string | null;
  retailSize: string | null;
  rrp: number | null;
}

/** Quantity-based tier pricing set by a shop (e.g. "5 for £10"). */
export interface CompareShopPriceTier {
  quantity: number;
  price: number;
}

export interface CompareShop {
  productAtShopId: string;
  shopId: string;
  shopName: string;
  shopAddress: string | null;
  shopMobile: string | null;
  price: number;
  offerPrice: number | null;
  offerExpiryDate: string | null;
  hasActiveOffer: boolean;
  /** `offerPrice` when the offer is live, otherwise `price`. */
  effectivePrice: number;
  priceTiers: CompareShopPriceTier[];
}

export interface CompareBundleItem {
  productId: string;
  productName: string;
  productImage: unknown;
  productBarcode: string | null;
  quantity: number;
}

export interface CompareBundle {
  id: string;
  name: string;
  description: string | null;
  promotionType: string;
  shopId: string;
  shopName: string;
  startDate: string | null;
  endDate: string | null;
  buyItems: CompareBundleItem[];
  getItems: CompareBundleItem[];
}

export interface CompareResponse {
  success: boolean;
  product: CompareProduct;
  shops: CompareShop[];
  bundles: CompareBundle[];
}

/**
 * A single purchase option surfaced in the ranked comparison list. Every
 * option is normalised to a "cost per single unit of the product" so the
 * whole list can be sorted lowest → highest regardless of pack shape.
 */
export type PurchaseOptionKind = 'single' | 'tier' | 'bundle';

export interface PurchaseOption {
  /** Stable key for FlatList. */
  key: string;
  kind: PurchaseOptionKind;
  shopId: string;
  shopName: string;
  shopAddress: string | null;
  productAtShopId: string;
  /** Short human label, e.g. "Single", "5 for £10", "Buy 3 get 1 free". */
  label: string;
  /** Longer subtitle shown in the card, e.g. "Pack of 4 for £10.00". */
  detail: string | null;
  /** Number of individual units the buyer walks away with. */
  unitsIncluded: number;
  /** Total pounds paid to get those units. */
  packagePrice: number;
  /** `packagePrice / unitsIncluded`. Used to rank options. */
  effectiveUnitPrice: number;
  /** Baseline single price at this same shop (for savings maths). */
  baselineSingleAtShop: number;
  /** Positive when this option beats the shop's own single price. */
  savingsPerUnit: number;
  /** Live single-item offer at this shop. */
  hasActiveOffer: boolean;
  offerExpiryDate: string | null;
  /** True on the option with the lowest effective unit price overall. */
  isBestValue: boolean;
}
