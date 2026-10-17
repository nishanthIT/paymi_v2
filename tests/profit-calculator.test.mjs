import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateProfit, parseCalculatorDecimal, stepCalculatorPercent } from '../src/features/shop-tools/profit-calculator.ts';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const manual = (overrides = {}) => calculateProfit({ purchaseCost: 8, units: 1, vatPercent: 20, priceMode: 'selling', sellingPrice: 12, ...overrides });
const target = (overrides = {}) => calculateProfit({ purchaseCost: 8, units: 1, vatPercent: 20, priceMode: 'target', targetPercent: 20, profitBasis: 'margin', ...overrides });

test('manual sale separates VAT, net revenue, margin and markup', () => {
  const result = manual();
  assert.equal(result.error, null);
  close(result.netSelling, 10);
  close(result.vatAmount, 2);
  close(result.profit, 2);
  close(result.totalProfit, 2);
  close(result.marginPercent, 20);
  close(result.markupPercent, 25);
});

test('target margin and target markup use distinct inverse formulas', () => {
  const margin = target();
  assert.equal(margin.sellingPrice, 12);
  close(margin.marginPercent, 20);
  const markup = target({ profitBasis: 'markup', targetPercent: 25 });
  assert.equal(markup.sellingPrice, 12);
  close(markup.markupPercent, 25);
  assert.equal(target({ profitBasis: 'markup', targetPercent: 20 }).sellingPrice, 11.52);
});

test('VAT and profit adjustments recalculate rounded target selling prices', () => {
  assert.equal(target({ vatPercent: 0 }).sellingPrice, 10);
  assert.equal(target({ vatPercent: 5 }).sellingPrice, 10.5);
  assert.equal(target({ targetPercent: 25 }).sellingPrice, 12.8);
  assert.equal(stepCalculatorPercent(20, 1, 100), '21');
  assert.equal(stepCalculatorPercent(5.5, -1, 100), '4.5');
  assert.equal(stepCalculatorPercent(0, -1, 100), '0');
  assert.equal(stepCalculatorPercent(99.5, 1, 99.99), '99.99');
  assert.equal(stepCalculatorPercent(null, 1, 100), '1');
});

test('case and bulk totals retain fractional unit costs without cumulative rounding', () => {
  const caseResult = manual({ purchaseCost: 10, units: 3, vatPercent: 0, sellingPrice: 4 });
  close(caseResult.unitCost, 10 / 3);
  close(caseResult.totalCost, 10);
  close(caseResult.totalSales, 12);
  close(caseResult.totalProfit, 2);
  const bulk = manual({ purchaseCost: 800, units: 100, sellingPrice: 12 });
  close(bulk.totalSales, 1200);
  close(bulk.totalVat, 200);
  close(bulk.totalProfit, 200);
});

test('rounded target prices achieve the percentage even with fractional unit costs', () => {
  const result = target({ purchaseCost: 10, units: 3, targetPercent: 30 });
  assert.equal(result.sellingPrice, 5.72);
  assert.ok(result.marginPercent >= 30);
  close(result.totalCost, 10);
  close(result.totalSales, 17.16);
  close(result.totalProfit, 4.3);
  assert.equal(target({ purchaseCost: 0.1, targetPercent: 0, vatPercent: 0 }).sellingPrice, 0.1);
});

test('manual losses and zero values produce finite results and honest undefined ratios', () => {
  const loss = manual({ sellingPrice: 6 });
  close(loss.profit, -3);
  close(loss.marginPercent, -60);
  close(loss.breakEvenPrice, 9.6);
  const free = manual({ purchaseCost: 0, sellingPrice: 0 });
  assert.equal(free.error, null);
  assert.equal(free.marginPercent, null);
  assert.equal(free.markupPercent, null);
  assert.equal(free.totalProfit, 0);
  const giveAway = manual({ sellingPrice: 0 });
  assert.equal(giveAway.marginPercent, null);
  assert.equal(giveAway.markupPercent, -100);
});

test('invalid quantities, percentages and excessive values cannot produce misleading results', () => {
  for (const units of [0, -1, 1.5, NaN, Infinity, 1_000_001]) assert.ok(manual({ units }).error);
  for (const vatPercent of [-1, NaN, Infinity, 101]) assert.ok(manual({ vatPercent }).error);
  for (const targetPercent of [-1, 100, 120, NaN, Infinity]) assert.ok(target({ targetPercent }).error);
  for (const purchaseCost of [-1, NaN, Infinity, 1_000_000_001]) assert.ok(manual({ purchaseCost }).error);
  assert.ok(manual({ sellingPrice: -1 }).error);
  assert.ok(manual({ units: 1_000_000, sellingPrice: 1_000_000 }).error);
  assert.equal(target({ targetPercent: 200, profitBasis: 'markup' }).error, null);
});

test('decimal input supports pounds and fractional percentages without interpreting garbage as zero', () => {
  assert.equal(parseCalculatorDecimal('12'), 12);
  assert.equal(parseCalculatorDecimal('12.50'), 12.5);
  assert.equal(parseCalculatorDecimal('.5'), 0.5);
  assert.equal(parseCalculatorDecimal('0'), 0);
  for (const text of ['', '.', '-20', '1e2', '10abc', '12.1.1', 'Infinity']) assert.equal(parseCalculatorDecimal(text), null);
});
