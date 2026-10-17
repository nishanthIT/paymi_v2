import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, dehydrate, hydrate, onlineManager } from '@tanstack/react-query';
import { installListReplay } from '../src/features/lists/replay.ts';
import { selectRefreshedSupermarket } from '../src/features/supermarkets/selection.ts';
import { canUseShopFeature } from '../src/features/employees/access.ts';

test('shop recovery restores employee list access after an initial directory outage without switching a revoked workspace', () => {
  const shops = [{ id: 'shop-a', permissions: ['feature.lists', 'feature.lists.write'] }];
  const selected = selectRefreshedSupermarket(shops, null, null, 'shop-a');
  const user = { userType: 'EMPLOYEE', shopId: selected.id, shopAccess: { shopId: selected.id, permissions: selected.permissions } };
  assert.equal(canUseShopFeature(user, 'feature.lists'), true);
  assert.equal(canUseShopFeature(user, 'feature.lists', 'write'), true);
  assert.equal(canUseShopFeature(user, 'feature.lists', 'edit'), false);
  assert.equal(selectRefreshedSupermarket(shops, 'revoked-shop', null, 'shop-a'), null);
  assert.equal(selectRefreshedSupermarket([{ id: 'a' }, { id: 'b' }], null, null, null), null);
  assert.equal(selectRefreshedSupermarket([{ id: 'a' }, { id: 'b' }], 'b', 'a', 'a').id, 'b');
});

test('shop read/write/edit controls fail closed for missing, mismatched and read-only memberships', () => {
  const user = { userType: 'EMPLOYEE', shopId: 'shop-a', shopAccess: { shopId: 'shop-a', permissions: ['feature.lists'] } };
  assert.equal(canUseShopFeature(user, 'feature.lists'), true);
  assert.equal(canUseShopFeature(user, 'feature.lists', 'write'), false);
  assert.equal(canUseShopFeature(user, 'feature.lists', 'edit'), false);
  assert.equal(canUseShopFeature({ ...user, shopAccess: { ...user.shopAccess, shopId: 'other' } }, 'feature.lists'), false);
  assert.equal(canUseShopFeature({ ...user, shopId: undefined }, 'feature.lists'), false);
  assert.equal(canUseShopFeature({ userType: 'CUSTOMER', shopId: 'shop-a' }, 'feature.lists', 'write'), true);
  assert.equal(canUseShopFeature(null, 'feature.lists'), false);
});

test('persisted list edits resume after restart with original IDs, quantity, urgency and stock, including moves and shared lists', async () => {
  const source = new QueryClient({ defaultOptions: { mutations: { gcTime: 0 } } });
  const restored = new QueryClient({ defaultOptions: { mutations: { gcTime: 0 } } });
  const calls = [];
  const methods = ['createList', 'deleteList', 'trackList', 'untrackList', 'renameList', 'claimBundle', 'addProductToList', 'removeProductFromList', 'updateProductQuantity', 'togglePurchased', 'toggleUrgent', 'changeProductShop', 'moveProductToList', 'markProductOutOfStock'];
  installListReplay(restored, Object.fromEntries(methods.map(name => [name, async input => { calls.push({ name, input }); }])));
  const cases = [
    ['create', { name: 'Restock' }, undefined, 'createList', { name: 'Restock' }],
    ['delete', 'list-a', undefined, 'deleteList', 'list-a'],
    ['track', 'list-a', undefined, 'trackList', 'list-a'],
    ['untrack', 'list-a', undefined, 'untrackList', 'list-a'],
    ['rename', { listId: 'list-a', name: 'Tomorrow' }, undefined, 'renameList', { listId: 'list-a', name: 'Tomorrow' }],
    ['add-product', { listId: 'list-a', product: { id: 'product-a', title: 'Milk' }, quantity: 4, isUrgent: true, inHandStock: 2 }, undefined, 'addProductToList', { listId: 'list-a', productId: 'product-a', quantity: 4, isUrgent: true, inHandStock: 2 }],
    ['remove-product', 'product-b', 'list-a', 'removeProductFromList', { listId: 'list-a', productId: 'product-b' }],
    ['update-quantity', { listProductId: 'row-a', quantity: 3 }, 'list-a', 'updateProductQuantity', { listId: 'list-a', listProductId: 'row-a', quantity: 3 }],
    ['toggle-purchased', 'row-a', 'list-a', 'togglePurchased', { listId: 'list-a', listProductId: 'row-a' }],
    ['toggle-urgent', 'row-a', 'list-a', 'toggleUrgent', { listId: 'list-a', listProductId: 'row-a' }],
    ['change-shop', { listProductId: 'row-a', productAtShopId: 'supply-a' }, 'list-a', 'changeProductShop', { listId: 'list-a', listProductId: 'row-a', productAtShopId: 'supply-a' }],
    ['move-to-list', { listProductId: 'row-a', targetListId: 'list-b' }, 'list-a', 'moveProductToList', { listId: 'list-a', listProductId: 'row-a', targetListId: 'list-b' }],
    ['mark-out-of-stock', { listProductId: 'row-a' }, 'list-a', 'markProductOutOfStock', { listId: 'list-a', listProductId: 'row-a' }],
    ['claim-bundle', { listId: 'list-a', productAtShopId: 'supply-a', bundlePromotionId: 'bundle', quantity: 2 }, undefined, 'claimBundle', { listId: 'list-a', productAtShopId: 'supply-a', bundlePromotionId: 'bundle', quantity: 2 }],
    ['add-product', { listId: 'out-of-stock', product: { id: 'product-a' }, quantity: 2 }, undefined, 'addProductToList', { listId: 'out-of-stock', productId: 'product-a', quantity: 2, isUrgent: undefined, inHandStock: undefined }],
    ['remove-product', { productId: 'product-a', listProductId: 'legacy-row' }, 'out-of-stock', 'removeProductFromList', { listId: 'out-of-stock', productId: 'product-a', listProductId: 'legacy-row' }],
    ['toggle-purchased', 'legacy-row', 'out-of-stock', 'togglePurchased', { listId: 'out-of-stock', listProductId: 'legacy-row' }],
    ['move-to-list', { listProductId: 'legacy-row', targetListId: 'original-list' }, 'out-of-stock', 'moveProductToList', { listId: 'out-of-stock', listProductId: 'legacy-row', targetListId: 'original-list' }],

  ];
  onlineManager.setOnline(false);
  const pending = cases.map(([operation, input, listId]) => source.getMutationCache().build(source, {
    mutationKey: listId ? ['lists', operation, listId] : ['lists', operation], mutationFn: async () => {},
  }).execute(input));
  await new Promise(resolve => setTimeout(resolve, 0));
  const snapshot = JSON.parse(JSON.stringify(dehydrate(source)));
  assert.equal(snapshot.mutations.length, cases.length);
  hydrate(restored, snapshot);
  onlineManager.setOnline(true);
  await restored.resumePausedMutations();
  assert.equal(restored.getMutationCache().getAll().every(m => m.state.status === 'success'), true);
  assert.deepEqual(calls, cases.map(([, , , name, input]) => ({ name, input })));
  await source.resumePausedMutations(); await Promise.all(pending);
  source.clear(); restored.clear();
});

test('legacy offline edits without list identity are rejected without contacting an arbitrary list', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { gcTime: 0 } } });
  let calls = 0;
  const api = new Proxy({}, { get: () => async () => { calls++; } });
  installListReplay(client, api);
  const mutation = client.getMutationCache().build(client, { mutationKey: ['lists', 'remove-product'] });
  await assert.rejects(mutation.execute('product-a'), /no verified list/);
  assert.equal(calls, 0);
  client.clear();
});
