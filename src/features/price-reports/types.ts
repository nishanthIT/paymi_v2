/** A product hit from the price-report fuzzy search. */
export interface ReportProduct {
  id: string;
  title: string;
  barcode?: string | null;
  img?: unknown;
}

/** A shop that stocks the product being reported. */
export interface ReportShop {
  id: string;
  name: string;
  address?: string | null;
  mobile?: string | null;
}

/** Live price of a product at one shop. */
export interface ShopPrice {
  price: number;
  originalPrice: number;
  offerPrice?: number | null;
  offerExpiryDate?: string | null;
  hasActiveOffer: boolean;
  lastUpdated: string;
}

/** Payload for submitting a wrong-price report. */
export interface SubmitPriceReportInput {
  /** Fast path when reporting from a list item (Collect Mode). */
  productAtShopId?: string;
  /** Manual path: product + shop pair. */
  productId?: string;
  shopId?: string;
  reportedPrice: number;
  currentPrice?: number;
  notes?: string;
}
