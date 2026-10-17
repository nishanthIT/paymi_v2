import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTemperature } from '../src/features/fridges/temperature.ts';
import { payoutDateBoundary } from '../src/features/supplier-payouts/dates.ts';

test('temperature input preserves negatives and zero while rejecting unfinished or malformed values', () => {
  for (const [input, expected] of [['-23', -23], ['-23.5', -23.5], ['0', 0], [' 8 ', 8], ['-.5', -0.5]]) assert.equal(parseTemperature(input), expected);
  for (const input of ['', ' ', '-', '-23abc', 'Infinity', '1e2', '0x10']) assert.equal(parseTemperature(input), null);
});

test('payout date filters cover the full local day including midnight across UTC boundaries', () => {
  const date = new Date(2026, 9, 12, 12, 30);
  const start = new Date(payoutDateBoundary(date));
  const end = new Date(payoutDateBoundary(date, true));
  assert.equal(start.getDate(), 12); assert.equal(start.getHours(), 0);
  assert.equal(end.getDate(), 12); assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59); assert.equal(end.getMilliseconds(), 999);
  assert.equal(date.getHours(), 12);
});
