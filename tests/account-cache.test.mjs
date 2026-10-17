import { Buffer } from 'node:buffer';
import test from 'node:test';
import assert from 'node:assert/strict';
import { labelIdentity, libraryKeys, hasAmbiguousLegacyLabels } from '../src/features/labels/model/storage-scope.ts';
import { cachedSessionMatches } from '../src/utils/cached-session.ts';
test('label drafts, saved work and print history separate colliding roles and shops without importing ambiguous legacy data', () => {
  const owner = libraryKeys(labelIdentity('CUSTOMER', 1), 'shop');
  const staff = libraryKeys(labelIdentity('EMPLOYEE', 1), 'shop');
  assert.equal(new Set([...Object.values(owner), ...Object.values(staff)]).size, 6);
  assert.notEqual(owner.saved, libraryKeys(labelIdentity('CUSTOMER', 1), 'other').saved);
  const legacy = ['labels.saved.v1.shop.1', 'labels.draft.v1.shop.1.shelf'];
  assert.ok(hasAmbiguousLegacyLabels(legacy, 1, 'shop'));
  assert.ok(!legacy.some(k => k.startsWith(owner.draftPrefix) || k === owner.saved));
  assert.ok(!hasAmbiguousLegacyLabels(legacy, 11, 'shop'));
});
test('offline identity cannot restore an expired, malformed or different-role session', () => {
  const token = claims => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
  const user = { id: 1, userType: 'CUSTOMER' };
  assert.ok(cachedSessionMatches(token({ id: 1, userType: 'CUSTOMER', exp: 2 }), user, 1000));
  assert.ok(!cachedSessionMatches(token({ id: 1, userType: 'EMPLOYEE', exp: 2 }), user, 1000));
  assert.ok(!cachedSessionMatches(token({ id: 1, userType: 'CUSTOMER', exp: 1 }), user, 1000));
  assert.ok(!cachedSessionMatches('invalid', user));
});
