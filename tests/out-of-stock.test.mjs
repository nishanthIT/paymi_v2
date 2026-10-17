import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collapseOutOfStockLists, isOutOfStockList,
  ordinaryListTargets, outOfStockSources, patchOutOfStockSource, restoreOutOfStockSource,
} from '../src/features/lists/out-of-stock.ts';
import { applyOptimisticProductAdd, listRemovalChoices, listRemovalKind, productSearchQuantityRows } from '../src/features/lists/list-management.ts';
import { collectionProducts, summarizeCollectionShops } from '../src/features/collect/model.ts';
import { listKeys } from '../src/features/lists/keys.ts';

const list = (id, name, itemCount = 1, extra = {}) => ({
  id, name, itemCount, description: '', createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-15T12:00:00Z', ...extra,
});
const row = (id, listId, shopId, extra = {}) => ({
  id, listId, shopId, sourceListName: 'Out of Stock', shopName: 'Same supplier name',
  productId: 'same-product', productAtShopId: `offer-${shopId}`, productName: 'Milk',
  quantity: 1, isPurchased: false, isUrgent: false, ...extra,
});

test('one overview card combines only already accessible legacy/canonical lists without mutating raw IDs or tracked access', () => {
  const lists = [list('normal', 'Weekly'), list('legacy-a', 'Out of Stock · Supplier A', 3),
    list('tracked', 'Out of Stock · Supplier B', 2, { copiedFromId: 'employee-b', copiedFromName: 'Employee B', isShared: true }),
    list('canonical', 'Out of Stock', 4), list('similar', 'Out of stock')];
  const before = structuredClone(lists);
  const overview = collapseOutOfStockLists(lists);
  assert.deepEqual(overview.map(item => item.name), ['Weekly', 'Out of Stock', 'Out of stock']);
  const aggregate = overview[1];
  assert.equal(aggregate.itemCount, 9);
  assert.equal(aggregate.isOutOfStockCollection, true);
  assert.deepEqual(aggregate.sourceListIds, ['legacy-a', 'tracked', 'canonical']);
  assert.deepEqual(lists, before);
  assert.deepEqual(collapseOutOfStockLists([lists[0], lists[1]])[1].sourceListIds, ['legacy-a']);
  assert.deepEqual(collapseOutOfStockLists([]), []);
});

test('shared Collect Mode keeps supplier identity and every real row through collecting, filters and undo', () => {
  const products = [row('a', 'legacy', 'shop-a', { quantity: 3, category: 'Drinks', aielNumber: '2' }),
    row('b', 'canonical', 'shop-b', { quantity: 7, category: 'Drinks', aielNumber: '10' }),
    row('c', 'canonical', 'shop-a', { isUrgent: true, category: 'Fresh' }),
    row('d', 'tracked', 'shop-a', { isPurchased: true, category: 'Fresh' })];
  const before = structuredClone(products);
  assert.deepEqual(summarizeCollectionShops(products), [
    { shopId: 'shop-a', shopName: 'Same supplier name', total: 3, collected: 1 },
    { shopId: 'shop-b', shopName: 'Same supplier name', total: 1, collected: 0 },
  ]);
  assert.deepEqual(collectionProducts(products, { shopId: 'shop-b' }).map(item => item.id), ['b']);
  assert.deepEqual(collectionProducts(products, { shopId: 'shop-a', category: 'Fresh', urgentOnly: true }).map(item => item.id), ['c']);
  assert.deepEqual(collectionProducts(products, { aisle: '2' }).map(item => item.id), ['a']);
  const collected = products.map(item => ({ ...item, isPurchased: true }));
  assert.equal(collectionProducts(collected, {}).length, 4, 'all collected rows remain visible for undo');
  assert.equal(summarizeCollectionShops(collected)[0].collected, 3);
  const undo = collected.map(item => item.id === 'b' ? { ...item, isPurchased: false } : item);
  assert.equal(summarizeCollectionShops(undo)[1].collected, 0);
  assert.deepEqual(products, before);
});

test('quantity, urgency and collection updates affect the real row/source only and never merge duplicate products', () => {
  const initial = { name: 'Out of Stock', products: [row('a', 'legacy', 'shop-a'), row('b', 'canonical', 'shop-a')] };
  const changed = patchOutOfStockSource(initial, 'legacy', products => products.map(item => ({ ...item, quantity: 8, isUrgent: true, isPurchased: true })));
  assert.equal(changed.products.length, 2);
  assert.deepEqual(changed.products.find(item => item.id === 'a'), { ...initial.products[0], quantity: 8, isUrgent: true, isPurchased: true });
  assert.deepEqual(changed.products.find(item => item.id === 'b'), initial.products[1]);
  assert.equal(patchOutOfStockSource(initial, 'inaccessible', () => []), initial);
});

test('failed move restores its removed source while retaining concurrent changes to another accessible list', () => {
  const initial = { name: 'Out of Stock', products: [row('a', 'legacy', 'shop-a'), row('b', 'canonical', 'shop-b')] };
  const moved = patchOutOfStockSource(initial, 'legacy', products => products.filter(item => item.id !== 'a'));
  assert.deepEqual(moved.products.map(item => item.id), ['b']);
  const otherChange = patchOutOfStockSource(moved, 'canonical', products => products.map(item => ({ ...item, quantity: 12 })));
  const restored = restoreOutOfStockSource(otherChange, 'legacy', [initial.products[0]]);
  assert.deepEqual(restored.products.find(item => item.id === 'a'), initial.products[0]);
  assert.equal(restored.products.find(item => item.id === 'b').quantity, 12);
});

test('ordinary destination pickers retain only original accessible lists, never a virtual or legacy out-of-stock target', () => {
  const lists = [list('source', 'Weekly'), list('target', 'Next week'), list('legacy', 'Out of Stock · A'),
    list('canonical', 'Out of Stock'), list('optimistic-new', 'Unsaved'), list('similar', 'Out of Stock planning')];
  assert.deepEqual(ordinaryListTargets(lists, 'source').map(item => item.id), ['target', 'similar']);
  assert.equal(isOutOfStockList('out of stock'), false);
  assert.equal(isOutOfStockList('Out of Stock planning'), false);
});

test('original-list management includes empty and tracked sources with real identities', () => {
  const sources = [list('empty', 'Out of Stock', 0), list('tracked', 'Out of Stock · B', 2, { isShared: true }),
    list('ordinary', 'Weekly'), list('optimistic-new', 'Out of Stock')];
  const selected = outOfStockSources(sources);
  assert.deepEqual(selected.map(source => source.id), ['empty', 'tracked']);
  assert.equal(selected[1].isShared, true);
  assert.equal(selected[0], sources[0]);
});

test('delete resolves only current accessible source lists and shared sources are untracked, never deleted', () => {
  const own = list('own', 'Out of Stock');
  const tracked = list('tracked', 'Out of Stock · A', 2, { isShared: true });
  const ordinary = list('normal', 'Weekly');
  const aggregate = collapseOutOfStockLists([own, tracked])[0];
  assert.deepEqual(listRemovalChoices(aggregate, [own, tracked, ordinary]).map(item => item.id), ['own', 'tracked']);
  assert.deepEqual(listRemovalChoices(aggregate, [own]), [own]);
  assert.deepEqual(listRemovalChoices(aggregate, [ordinary]), [], 'stale aggregate cannot target a hidden old source');
  assert.deepEqual(listRemovalChoices(ordinary, [own, ordinary]), [ordinary]);
  assert.equal(listRemovalKind(own), 'delete');
  assert.equal(listRemovalKind(tracked), 'untrack');
  assert.equal(listRemovalKind({ ...tracked, isShared: false, copiedFromId: 'owner' }), 'untrack');
});

test('adding a product to Out of Stock never changes matching items in legacy/tracked supplier rows', () => {
  const products = [row('a', 'legacy', 'shop-a', { quantity: 3 }), row('b', 'tracked', 'shop-b', { quantity: 8 })];
  const pending = row('optimistic-new', '', '', { quantity: 2, isUrgent: true });
  const actual = applyOptimisticProductAdd('out-of-stock', products, pending);
  assert.equal(actual.alreadyInList, false);
  assert.deepEqual(actual.products, [pending, ...products]);
  assert.deepEqual(productSearchQuantityRows('out-of-stock', products), new Map());
  assert.deepEqual(productSearchQuantityRows('ordinary', products), new Map(), 'duplicate product row cannot be picked arbitrarily');
  const one = applyOptimisticProductAdd('ordinary', [products[0]], pending);
  assert.equal(one.alreadyInList, true);
  assert.equal(one.products[0].quantity, 5);
  assert.equal(one.products[0].isUrgent, true);
  assert.deepEqual(productSearchQuantityRows('ordinary', [products[0]]).get('same-product'), { id: 'a', quantity: 3 });
});

test('list and Collect Mode use the same aggregate cache and never collapse a pending list into a usable server target', () => {
  assert.deepEqual(listKeys.detail('out-of-stock'), listKeys.outOfStock);
  assert.deepEqual(listKeys.detail('normal'), ['list', 'normal']);
  const pending = list('optimistic-new', 'Out of Stock');
  assert.deepEqual(collapseOutOfStockLists([pending]), [pending]);
});
