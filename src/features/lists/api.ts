import api from '@/services/api';

import type {
  AddProductResult,
  BundleCheckResult,
  ListDetails,
  ListProduct,
  PackOptionsResult,
  PriceTiersResult,
  Product,
  ShoppingList,
} from './types';

/**
 * Thin wrappers over the existing backend endpoints.
 * The backend is the source of truth — request/response shapes here
 * mirror authRoutes.js + listRoutes.js exactly.
 */

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error; // 401 auto-logout in flight
  return new Error(error?.response?.data?.error || fallback);
}

export async function fetchLists(): Promise<ShoppingList[]> {
  try {
    const response = await api.get('/lists');
    return response.data.lists || [];
  } catch (error: any) {
    throw apiError(error, 'Failed to load your lists');
  }
}

export async function fetchListDetails(listId: string): Promise<ListDetails> {
  try {
    const response = await api.get(`/lists/${listId}`);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to load list');
  }
}

export async function createList(input: {
  name: string;
  description?: string;
}): Promise<ShoppingList> {
  try {
    const response = await api.post('/lists', input);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to create list');
  }
}

export async function deleteList(listId: string): Promise<void> {
  try {
    await api.delete(`/lists/${listId}`);
  } catch (error: any) {
    throw apiError(error, 'Failed to delete list');
  }
}

/** Renames a list. Syncs to every tracker/owner via the shop socket room. */
export async function renameList(input: { listId: string; name: string }): Promise<void> {
  try {
    await api.put(`/lists/${input.listId}/rename`, { name: input.name });
  } catch (error: any) {
    throw apiError(error, 'Failed to rename list');
  }
}

/**
 * Shop owner (CUSTOMER) tracks an employee's list so it appears under their own
 * Shopping Lists — the SAME shared list, never a duplicate. Backend keeps both
 * users in sync via the shop socket room.
 */
export async function trackList(listId: string): Promise<void> {
  try {
    await api.post(`/shop/copy-list/${listId}`);
  } catch (error: any) {
    throw apiError(error, 'Failed to add this list');
  }
}

/** Stops tracking a shared list (removes it from my lists without deleting it). */
export async function untrackList(listId: string): Promise<void> {
  try {
    await api.delete(`/lists/${listId}/untrack`);
  } catch (error: any) {
    throw apiError(error, 'Failed to remove this list');
  }
}

/**
 * Adds a product (by logical productId) to a list. The backend picks the
 * cheapest in-stock shop and increments quantity when the product already
 * exists. When `quantity` > 1 we follow up with an absolute quantity update.
 */
export async function addProductToList(input: {
  listId: string;
  productId: string;
  quantity?: number;
  isUrgent?: boolean;
  inHandStock?: number;
}): Promise<AddProductResult> {
  const { listId, productId, quantity = 1, isUrgent, inHandStock } = input;
  try {
    const response = await api.post('/lists/addProduct', {
      listId,
      productId,
      ...(isUrgent ? { isUrgent: true } : {}),
      ...(inHandStock != null ? { inHandStock } : {}),
    });
    const result: AddProductResult = response.data;

    if (quantity > 1 && result?.data?.listProductId) {
      const finalQuantity = (result.data.quantity || 1) + (quantity - 1);
      await updateProductQuantity({
        listId,
        listProductId: result.data.listProductId,
        quantity: finalQuantity,
      });
      result.data.quantity = finalQuantity;
    }

    return result;
  } catch (error: any) {
    throw apiError(error, 'Failed to add product');
  }
}

export async function removeProductFromList(input: {
  listId: string;
  productId: string;
}): Promise<void> {
  try {
    await api.delete('/lists/removeProduct', { data: input });
  } catch (error: any) {
    throw apiError(error, 'Failed to remove product');
  }
}

export async function updateProductQuantity(input: {
  listId: string;
  listProductId: string;
  quantity: number;
}): Promise<void> {
  try {
    await api.put('/lists/updateQuantity', {
      listId: input.listId,
      listProductId: input.listProductId,
      quantity: input.quantity,
    });
  } catch (error: any) {
    throw apiError(error, 'Failed to update quantity');
  }
}

export async function togglePurchased(input: {
  listId: string;
  listProductId: string;
}): Promise<void> {
  try {
    await api.put('/lists/togglePurchased', input);
  } catch (error: any) {
    throw apiError(error, 'Failed to update item');
  }
}

export async function toggleUrgent(input: {
  listId: string;
  listProductId: string;
}): Promise<void> {
  try {
    await api.put('/lists/toggleUrgent', input);
  } catch (error: any) {
    throw apiError(error, 'Failed to update item');
  }
}

/** Moves a list item to the same product at a different shop. */
export async function changeProductShop(input: {
  listId: string;
  listProductId: string;
  productAtShopId: string;
}): Promise<{ message: string }> {
  try {
    const response = await api.put('/lists/changeShop', input);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to move product to another shop');
  }
}

export async function searchProducts(query: string): Promise<Product[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  try {
    const response = await api.get('/products/search', {
      params: { q: term, limit: 20 },
    });
    return response.data.data || [];
  } catch (error: any) {
    throw apiError(error, 'Search failed');
  }
}

/** Returns null when the barcode is unknown (backend 404). */
export async function fetchProductByBarcode(barcode: string): Promise<Product | null> {
  try {
    const response = await api.get(`/products/barcode/${encodeURIComponent(barcode)}`);
    return response.data.data || response.data || null;
  } catch (error: any) {
    if (error?.response?.status === 404) return null;
    throw apiError(error, 'Barcode lookup failed');
  }
}

/**
 * All known category names: the managed Category table merged with the
 * distinct categories already used on products, deduped case-insensitively.
 */
export async function fetchCategories(): Promise<string[]> {
  try {
    const [managed, fromProducts] = await Promise.all([
      api.get('/categories').then((r) => r.data?.data ?? []).catch(() => []),
      api.get('/categories/product-categories').then((r) => r.data?.data ?? []).catch(() => []),
    ]);
    const seen = new Map<string, string>();
    for (const entry of [...managed.map((c: any) => c?.name), ...fromProducts]) {
      const name = typeof entry === 'string' ? entry.trim() : '';
      if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  } catch (error: any) {
    throw apiError(error, 'Failed to load categories');
  }
}

/**
 * Submits an unknown scanned barcode via the existing quick-add endpoint.
 * The product lands in the backend's pending-submissions queue (category
 * USER_SUBMITTED_PENDING) for an admin to review and approve. It also has a
 * usable ProductAtShop row (Unknown Shop) so it can be added to a list right away.
 */
export async function submitNewProduct(input: {
  barcode: string;
  title: string;
  retailSize?: string;
  category?: string;
  inHandStock?: number;
}): Promise<Product> {
  try {
    const response = await api.post('/products/quick-add', {
      barcode: input.barcode,
      title: input.title,
      // retailSize is required server-side; fall back when left blank.
      retailSize: input.retailSize?.trim() || 'N/A',
      ...(input.category?.trim() ? { category: input.category.trim() } : {}),
      ...(input.inHandStock != null ? { inHandStock: input.inHandStock } : {}),
    });
    return response.data?.data;
  } catch (error: any) {
    if (error?.response?.status === 409) {
      throw new Error('This product already exists — try searching for it instead.');
    }
    throw apiError(error, 'Failed to submit product');
  }
}

/** Helper used by optimistic updates and Collect Mode groundwork. */
export function sortListProducts(products: ListProduct[]): ListProduct[] {
  return [...products].sort((a, b) => {
    if (a.isPurchased !== b.isPurchased) return a.isPurchased ? 1 : -1;
    return a.productName.localeCompare(b.productName);
  });
}

/**
 * Checks whether a product belongs to an active bundle offer BEFORE adding it
 * (existing backend endpoint). Never throws — a failed check (e.g. offline)
 * must never block the normal add flow, so it degrades to null.
 */
export async function checkBundleBeforeAdd(input: {
  productId: string;
  listId?: string;
}): Promise<BundleCheckResult | null> {
  try {
    const response = await api.post('/lists/check-bundle-before-add', input, {
      timeout: 15000,
    });
    console.log(
      '[bundle-check] status ok, hasOffers =',
      response.data?.hasOffers,
      'offers =',
      response.data?.offers?.length ?? 0,
    );
    return response.data ?? null;
  } catch (error: any) {
    console.warn(
      '[bundle-check] FAILED — falling back to single add:',
      error?.response?.status ?? error?.code ?? error?.message ?? error,
    );
    return null;
  }
}

/** Claims a bundle offer — the backend adds the buy quantity + free items to the list. */
export async function claimBundle(input: {
  listId: string;
  productAtShopId: string;
  bundlePromotionId: string;
  quantity: number;
}): Promise<void> {
  try {
    await api.post('/lists/claim-bundle', input);
  } catch (error: any) {
    throw apiError(error, 'Failed to add the bundle offer');
  }
}

/**
 * Fetches other purchase formats (single / pack / case) of the same product
 * with unit prices. Degrades to null on failure — pack comparison is an
 * enhancement, never a blocker.
 */
export async function fetchPackOptions(productId: string): Promise<PackOptionsResult | null> {
  try {
    const response = await api.get(`/products/${encodeURIComponent(productId)}/pack-options`);
    return response.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Quantity-based price tiers (e.g. 7 for £9.00) from the lowest-priced shop.
 * Degrades to null on failure — tiers are an enhancement, never a blocker.
 */
export async function fetchPriceTiers(productId: string): Promise<PriceTiersResult | null> {
  try {
    const response = await api.get(`/products/${encodeURIComponent(productId)}/price-tiers`);
    return response.data ?? null;
  } catch {
    return null;
  }
}
