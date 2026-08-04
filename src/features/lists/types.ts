/** Shapes returned by the existing backend list/product endpoints. */

export interface ShoppingList {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  /** Set when this list is shared from another owner (tracked, not duplicated). */
  copiedFromName?: string | null;
  copiedFromId?: string | null;
}

export interface ListProduct {
  id: string; // listProduct id
  productId: string;
  productAtShopId: string;
  productName: string;
  barcode: string;
  caseBarcode?: string;
  retailSize?: string;
  caseSize?: string;
  packetSize?: string;
  aielNumber?: string;
  locationCode?: string;
  category: string;
  lowestPrice: number;
  originalPrice: number;
  offerPrice: number | null;
  hasActiveOffer: boolean;
  shopName: string;
  shopId: string;
  img: string | null;
  quantity: number;
  isPurchased: boolean;
  isFreeItem?: boolean;
  freeQuantity?: number;
  bundlePromotionId?: string | null;
}

export interface ListDetails {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  shopId?: string | null;
  creatorType?: string;
  products: ListProduct[];
}

/** Product row returned by /products/search and /products/barcode/:barcode. */
export interface Product {
  id: string;
  title: string;
  barcode?: string | null;
  caseBarcode?: string | null;
  img?: unknown;
  retailSize?: string | null;
  caseSize?: string | null;
  packetSize?: string | null;
  rrp?: number | null;
  category?: string | null;
  availableInShops?: number;
  lowestPrice?: number | null;
}

export interface AddProductResult {
  success: boolean;
  message: string;
  alreadyExists?: boolean;
  data: {
    listProductId: string;
    productAtShopId: string;
    quantity: number;
    productName: string;
    lowestPrice: number;
    originalPrice?: number;
    offerPrice?: number | null;
    hasActiveOffer?: boolean;
    shopName: string;
    availableInShops: number;
  };
}

/** One free item granted by a bundle promotion. */
export interface BundleFreeItem {
  productId: string;
  productName: string;
  productImage?: unknown;
  freeQuantity: number;
}

/** An active bundle offer returned by POST /lists/check-bundle-before-add. */
export interface BundleOffer {
  bundlePromotionId: string;
  name: string;
  description?: string | null;
  promotionType: string;
  buyQuantityRequired: number;
  currentQuantityInList?: number;
  additionalNeeded: number;
  isEligible: boolean;
  freeItems: BundleFreeItem[];
  offerMessage: string;
}

/** Response of POST /lists/check-bundle-before-add. */
export interface BundleCheckResult {
  productId: string;
  productAtShopId: string;
  productName: string;
  productImage?: unknown;
  productBarcode?: string | null;
  shopId: string;
  shopName: string;
  price: number;
  originalPrice: number;
  offerPrice: number | null;
  hasActiveOffer: boolean;
  availableInShops: number;
  offers: BundleOffer[];
  hasOffers: boolean;
  currentQuantityInList: number;
}

/** One purchase-format option from GET /products/:id/pack-options. */
export interface PackOption {
  productId: string;
  title: string;
  barcode?: string | null;
  img?: unknown;
  packetSize?: string | null;
  retailSize?: string | null;
  caseSize?: string | null;
  category?: string | null;
  availableInShops: number;
  price: number | null;
  originalPrice: number | null;
  hasActiveOffer: boolean;
  packCount: number;
  sizeText: string | null;
  sizeLabel: string | null;
  /** Price per single unit inside the pack. */
  unitPrice: number | null;
  isCurrent: boolean;
  isBestValue: boolean;
}

export interface PackOptionsResult {
  productId: string;
  options: PackOption[];
  hasOptions: boolean;
}

/** Quantity-based price tier set by the shop, e.g. 7 for £9.00. */
export interface PriceTier {
  quantity: number;
  price: number;
  unitPrice: number;
  /** Saved vs buying the same quantity at the single price. */
  savings: number | null;
}

export interface PriceTiersResult {
  productId: string;
  shopName: string | null;
  basePrice: number | null;
  tiers: PriceTier[];
  hasTiers: boolean;
}
