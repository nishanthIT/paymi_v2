import { OUT_OF_STOCK_ID, outOfStockSources } from './out-of-stock';
import type { ListProduct, ShoppingList } from './types';

/** Resolve display-only collections to real accessible lists before confirming removal. */
export function listRemovalChoices(list: ShoppingList, lists: readonly ShoppingList[]): ShoppingList[] {
  return list.id === OUT_OF_STOCK_ID ? outOfStockSources(lists) : [list];
}

export function listRemovalKind(list: ShoppingList): 'delete' | 'untrack' {
  return list.isShared || list.copiedFromId || list.copiedFromName ? 'untrack' : 'delete';
}

/** A virtual collection may contain the same product in multiple old lists.
 * Only the server knows which canonical row an add will update. */
export function applyOptimisticProductAdd(listId: string, products: readonly ListProduct[], pending: ListProduct) {
  const matches = products.filter(product => product.productId === pending.productId);
  const existing = listId !== OUT_OF_STOCK_ID && matches.length === 1 ? matches[0] : undefined;
  return {
    alreadyInList: !!existing,
    products: existing ? products.map(product => product.id === existing.id
      ? { ...product, quantity: product.quantity + pending.quantity, isUrgent: product.isUrgent || pending.isUrgent }
      : product) : [pending, ...products],
  };
}

/** Search results identify a product, not an individual supplier/source row.
 * Keep exact-row quantity editing on the list when that identity is ambiguous. */
export function productSearchQuantityRows(listId: string, products: readonly ListProduct[]) {
  const rows = new Map<string, { id: string; quantity: number }>();
  if (listId === OUT_OF_STOCK_ID) return rows;
  const duplicates = new Set<string>();
  for (const product of products) {
    if (product.id.startsWith('optimistic-')) continue;
    if (rows.has(product.productId)) duplicates.add(product.productId);
    rows.set(product.productId, { id: product.id, quantity: product.quantity });
  }
  for (const id of duplicates) rows.delete(id);
  return rows;
}
