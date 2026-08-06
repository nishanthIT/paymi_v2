import type {
  CompareBundle,
  CompareResponse,
  CompareShop,
  PurchaseOption,
} from './types';

const round = (value: number): number => Math.round(value * 100) / 100;

function money(value: number): string {
  return `£${value.toFixed(2)}`;
}

function bundleLabel(bundle: CompareBundle, buyQuantity: number, freeQuantity: number): string {
  const type = bundle.promotionType?.toUpperCase();
  if (type === 'BOGO' || (buyQuantity === 1 && freeQuantity === 1)) return 'Buy One Get One Free';
  if (freeQuantity > 0) return `Buy ${buyQuantity} get ${freeQuantity} free`;
  return bundle.name || `Bundle`;
}

/**
 * Turns a comparison payload into a ranked list of purchase options.
 *
 * Every shop can produce up to three flavours of option:
 *   - `single`  → one unit at the shop's live effective price
 *   - `tier`    → a quantity-based tier ("5 for £20") from `priceTiers`
 *   - `bundle`  → a `BundlePromotion` at that shop that grants free copies
 *                 of the same product ("Buy 3 get 1 free")
 *
 * Options are normalised to `effectiveUnitPrice = packagePrice / unitsIncluded`
 * and sorted lowest → highest. The cheapest per-unit option wins the
 * `isBestValue` flag and floats to the top of the list.
 */
export function buildPurchaseOptions(data: CompareResponse): PurchaseOption[] {
  const productId = data.product.id;
  const options: PurchaseOption[] = [];

  // Index bundles by shop so we only walk them once per shop.
  const bundlesByShop = new Map<string, CompareBundle[]>();
  for (const bundle of data.bundles) {
    const list = bundlesByShop.get(bundle.shopId) ?? [];
    list.push(bundle);
    bundlesByShop.set(bundle.shopId, list);
  }

  for (const shop of data.shops) {
    options.push(...optionsForShop(shop, bundlesByShop.get(shop.shopId) ?? [], productId));
  }

  options.sort((a, b) => a.effectiveUnitPrice - b.effectiveUnitPrice);

  if (options.length > 0) {
    const best = options[0].effectiveUnitPrice;
    for (const option of options) {
      option.isBestValue = Math.abs(option.effectiveUnitPrice - best) < 0.005;
    }
  }

  return options;
}

function optionsForShop(
  shop: CompareShop,
  bundles: CompareBundle[],
  productId: string,
): PurchaseOption[] {
  const baseline = shop.effectivePrice;
  const results: PurchaseOption[] = [];

  const singleLabel = shop.hasActiveOffer ? 'Single (offer price)' : 'Single';
  const singleDetail = shop.hasActiveOffer
    ? `Was ${money(shop.price)} · now ${money(shop.effectivePrice)}`
    : `${money(shop.price)} each`;
  results.push({
    key: `single:${shop.productAtShopId}`,
    kind: 'single',
    shopId: shop.shopId,
    shopName: shop.shopName,
    shopAddress: shop.shopAddress,
    productAtShopId: shop.productAtShopId,
    label: singleLabel,
    detail: singleDetail,
    unitsIncluded: 1,
    packagePrice: round(shop.effectivePrice),
    effectiveUnitPrice: round(shop.effectivePrice),
    baselineSingleAtShop: baseline,
    savingsPerUnit: 0,
    hasActiveOffer: shop.hasActiveOffer,
    offerExpiryDate: shop.offerExpiryDate,
    isBestValue: false,
  });

  for (const tier of shop.priceTiers) {
    if (!tier.quantity || tier.quantity < 2 || tier.price == null) continue;
    const unit = round(tier.price / tier.quantity);
    results.push({
      key: `tier:${shop.productAtShopId}:${tier.quantity}`,
      kind: 'tier',
      shopId: shop.shopId,
      shopName: shop.shopName,
      shopAddress: shop.shopAddress,
      productAtShopId: shop.productAtShopId,
      label: `${tier.quantity} for ${money(tier.price)}`,
      detail: `${money(unit)} per item · pack of ${tier.quantity}`,
      unitsIncluded: tier.quantity,
      packagePrice: round(tier.price),
      effectiveUnitPrice: unit,
      baselineSingleAtShop: baseline,
      savingsPerUnit: round(baseline - unit),
      hasActiveOffer: shop.hasActiveOffer,
      offerExpiryDate: shop.offerExpiryDate,
      isBestValue: false,
    });
  }

  for (const bundle of bundles) {
    const buyQty = bundle.buyItems
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    if (buyQty <= 0) continue;

    // Only count "free" items that grant more of the same product — that's
    // what makes them a proper multi-buy on this listing.
    const freeQty = bundle.getItems
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    const totalUnits = buyQty + freeQty;
    if (totalUnits <= buyQty) continue;

    const packagePrice = round(buyQty * shop.effectivePrice);
    const unit = round(packagePrice / totalUnits);

    results.push({
      key: `bundle:${bundle.id}:${shop.productAtShopId}`,
      kind: 'bundle',
      shopId: shop.shopId,
      shopName: shop.shopName,
      shopAddress: shop.shopAddress,
      productAtShopId: shop.productAtShopId,
      label: bundleLabel(bundle, buyQty, freeQty),
      detail: `Pay for ${buyQty}, take ${totalUnits} · ${money(packagePrice)} total`,
      unitsIncluded: totalUnits,
      packagePrice,
      effectiveUnitPrice: unit,
      baselineSingleAtShop: baseline,
      savingsPerUnit: round(baseline - unit),
      hasActiveOffer: shop.hasActiveOffer,
      offerExpiryDate: shop.offerExpiryDate,
      isBestValue: false,
    });
  }

  return results;
}
