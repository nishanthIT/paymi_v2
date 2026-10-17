/** Prices are GBP; purchase cost excludes any VAT the business can recover. */
export type ProfitBasis = 'margin' | 'markup';
export type PriceMode = 'selling' | 'target';

export interface ProfitCalculationInput {
  purchaseCost: number;
  units: number;
  vatPercent: number;
  priceMode: PriceMode;
  sellingPrice?: number;
  targetPercent?: number;
  profitBasis?: ProfitBasis;
}

const MAX_MONEY = 1_000_000_000;

/** Parse user-entered decimals, rejecting exponents, signs and partial garbage. */
export function parseCalculatorDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function stepCalculatorPercent(value: number | null, delta: number, max: number): string {
  return String(Math.round(Math.min(max, Math.max(0, (value ?? 0) + delta)) * 100) / 100);
}

/**
 * Round target prices up to a penny so the displayed price achieves the target.
 * Keep fractional unit costs until totals are calculated (e.g. £10 / 3 units).
 * VAT/profit are estimates; only the final monetary display is rounded.
 */
export function calculateProfit(input: ProfitCalculationInput) {
  const { purchaseCost, units, vatPercent, priceMode } = input;
  if (!Number.isFinite(purchaseCost) || purchaseCost < 0 || purchaseCost > MAX_MONEY) {
    return { error: 'Enter a valid purchase cost up to £1,000,000,000.' } as const;
  }
  if (!Number.isSafeInteger(units) || units < 1 || units > 1_000_000) {
    return { error: 'Enter a whole quantity between 1 and 1,000,000.' } as const;
  }
  if (!Number.isFinite(vatPercent) || vatPercent < 0 || vatPercent > 100) {
    return { error: 'Enter a VAT percentage between 0 and 100.' } as const;
  }
  const unitCost = purchaseCost / units;
  const vatMultiplier = 1 + vatPercent / 100;
  let sellingPrice = input.sellingPrice;
  if (priceMode === 'target') {
    const target = input.targetPercent;
    const basis = input.profitBasis ?? 'margin';
    if (target == null || !Number.isFinite(target) || target < 0 || (basis === 'margin' && target >= 100)) {
      return { error: basis === 'margin' ? 'Profit margin must be at least 0% and below 100%.' : 'Enter a profit markup of at least 0%.' } as const;
    }
    const netTarget = basis === 'margin' ? unitCost / (1 - target / 100) : unitCost * (1 + target / 100);
    sellingPrice = Math.ceil(netTarget * vatMultiplier * 100 - 1e-8) / 100;
  }
  if (sellingPrice == null || !Number.isFinite(sellingPrice) || sellingPrice < 0 || sellingPrice > MAX_MONEY) {
    return { error: 'Enter a valid selling price up to £1,000,000,000.' } as const;
  }
  const netSelling = sellingPrice / vatMultiplier;
  const profit = netSelling - unitCost;
  const totalSales = sellingPrice * units;
  if (!Number.isFinite(totalSales) || totalSales > MAX_MONEY) {
    return { error: 'Total sales must not exceed £1,000,000,000.' } as const;
  }
  const totalNetSales = totalSales / vatMultiplier;
  const totalProfit = totalNetSales - purchaseCost;
  return {
    error: null,
    unitCost,
    sellingPrice,
    netSelling,
    vatAmount: sellingPrice - netSelling,
    profit,
    marginPercent: netSelling > 0 ? profit / netSelling * 100 : null,
    markupPercent: unitCost > 0 ? profit / unitCost * 100 : null,
    units,
    totalCost: purchaseCost,
    totalSales,
    totalVat: totalSales - totalNetSales,
    totalProfit,
    breakEvenPrice: Math.ceil(unitCost * vatMultiplier * 100 - 1e-8) / 100,
  } as const;
}
