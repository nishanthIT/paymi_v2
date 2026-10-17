import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, dehydrate, hydrate, onlineManager } from '@tanstack/react-query';
import { selectSupermarket, supermarketCacheKey, assertSwitchReady } from '../src/features/supermarkets/selection.ts';
import { getSupermarketScope, setSupermarketScope, beginScopedWrite, endScopedWrite, hasScopedWrites } from '../src/features/supermarkets/scope.ts';
test('restored active/default preference never grants access or guesses among multiple shops', () => {
  const shops = [{ id: 'a' }, { id: 'b' }];
  assert.equal(selectSupermarket(shops, 'b', 'a').id, 'b');
  assert.equal(selectSupermarket(shops, 'revoked', 'a').id, 'a');
  assert.equal(selectSupermarket(shops, null, null), null);
  assert.equal(selectSupermarket([{ id: 'a' }], null, 'supplier').id, 'a');
  assert.equal(selectSupermarket([], 'supplier', 'supplier'), null);
});
test('persistent cache names separate identity type, user, and supermarket', () => {
  assert.equal(new Set([supermarketCacheKey('CUSTOMER', '1', 'a'), supermarketCacheKey('CUSTOMER', '1', 'b'), supermarketCacheKey('EMPLOYEE', '1', 'a'), supermarketCacheKey('CUSTOMER', '2', 'a')]).size, 4);
});
test('pending offline mutations block switching and replay only in their restored shop cache', async () => {
  onlineManager.setOnline(false);
  const a = new QueryClient(); a.mount();
  const mutation = a.getMutationCache().build(a, { mutationKey: ['lists', 'create'], mutationFn: async (v) => v });
  const pending = mutation.execute({ name: 'A pending order' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(mutation.state.isPaused, true);
  assert.throws(() => assertSwitchReady(a.isMutating(), false), /syncing/);
  const stored = JSON.parse(JSON.stringify(dehydrate(a)));
  a.unmount();
  const b = new QueryClient();
  assert.equal(b.getMutationCache().getAll().length, 0);
  let replayed;
  const restoredA = new QueryClient();
  restoredA.setMutationDefaults(['lists', 'create'], { mutationFn: async (v) => { replayed = { shop: 'a', ...v }; } });
  hydrate(restoredA, stored);
  assert.throws(() => assertSwitchReady(restoredA.isMutating(), false));
  onlineManager.setOnline(true);
  await restoredA.resumePausedMutations();
  assert.deepEqual(replayed, { shop: 'a', name: 'A pending order' });
  assert.doesNotThrow(() => assertSwitchReady(restoredA.isMutating(), false));
  await a.resumePausedMutations(); await pending;
  a.clear(); b.clear(); restoredA.clear();
});
test('uploads block switching, and scope generations invalidate stale responses even after switching back', () => {
  setSupermarketScope('a'); const captured = getSupermarketScope();
  beginScopedWrite(); assert.throws(() => assertSwitchReady(0, hasScopedWrites())); endScopedWrite();
  assert.doesNotThrow(() => assertSwitchReady(0, hasScopedWrites()));
  setSupermarketScope('b'); setSupermarketScope('a');
  assert.notEqual(captured.generation, getSupermarketScope().generation);
  assert.equal(captured.id, 'a');
});
