import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTemperature, temperatureEntry } from '../src/features/fridges/temperature.ts';
import { categoryOptions } from '../src/features/age-restriction/categories.ts';

test('freezer keypad defaults below zero, explicit plus preserves abnormal positive readings, and fridges remain positive', () => {
  assert.equal(parseTemperature(temperatureEntry('23', true).text), -23);
  assert.equal(parseTemperature(temperatureEntry('23.5', true).text), -23.5);
  assert.equal(parseTemperature(temperatureEntry('+4', true).text), 4);
  assert.equal(parseTemperature(temperatureEntry('3.5', false).text), 3.5);
  assert.equal(parseTemperature(temperatureEntry('−23,5', false).text), -23.5);
  assert.equal(parseTemperature(temperatureEntry('0', true).text), -0);
  for (const text of ['', '.', '-', '23abc', '1.2.3']) assert.equal(parseTemperature(temperatureEntry(text, true).text), null);
});

test('category search preserves legacy selections, deduplicates names, and only offers a distinct new category', () => {
  const all = categoryOptions(['Alcohol', 'alcohol', 'Soft Drinks'], 'Legacy department', '');
  assert.deepEqual(all.matches, ['Alcohol', 'Legacy department', 'Soft Drinks']);
  assert.equal(all.canAdd, false);
  assert.deepEqual(categoryOptions(all.matches, '', 'ALCO').matches, ['Alcohol']);
  assert.equal(categoryOptions(all.matches, '', ' alcohol ').canAdd, false);
  assert.equal(categoryOptions(all.matches, '', 'Household').canAdd, true);
});
