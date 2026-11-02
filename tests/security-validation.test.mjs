import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword } from '../src/utils/validation.ts';

test('new account and recovery password validation respects bcrypt UTF-8 boundaries', () => {
  assert.ok(validatePassword('1234567'));
  assert.equal(validatePassword('12345678'), null);
  assert.equal(validatePassword('x'.repeat(72)), null);
  assert.ok(validatePassword('x'.repeat(73)));
  assert.equal(validatePassword('€'.repeat(24)), null);
  assert.ok(validatePassword('€'.repeat(25)));
  assert.equal(validatePassword('🙂'.repeat(18)), null);
  assert.ok(validatePassword('🙂'.repeat(19)));
});
