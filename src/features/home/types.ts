/** Home & promotions module — mirrors the existing backend contracts exactly. */

export interface Advertisement {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  sourceUrl: string;
  isActive: boolean;
  publishedAt: string;
}

export interface PromotionProduct {
  id: string;
  title: string;
  barcode: string | null;
  img: unknown;
  rrp: number | string | null;
  category: string | null;
  /** Shop-specific price at the promotion's shop. */
  price: number | string | null;
  offerPrice: number | string | null;
}

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  imageUrls: string[];
  pdfUrl: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  shop: { id: string; name: string; address?: string | null } | null;
  products: PromotionProduct[];
}
