import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPurchaseOptions } from '../src/features/compare/engine.ts';

const shop = overrides => ({ productAtShopId:'pas',shopId:'shop',shopName:'Bestway',shopAddress:null,shopMobile:null,price:0.6,effectivePrice:0.6,offerPrice:null,offerExpiryDate:null,hasActiveOffer:false,priceTiers:[],...overrides });
const options = shops => buildPurchaseOptions({ success:true, product:{ id:'product' },shops,bundles:[] });

test('Dhamecha current case total compares per retail unit against Bestway unit and case prices', () => {
  const result = options([
    shop({ shopId:'dh',productAtShopId:'dh',shopName:'Dhamecha',price:8.49,effectivePrice:4.79,offerPrice:4.79,unitsPerPack:12,pricedUnitSize:'120g',hasActiveOffer:true }),
    shop({ unitsPerPack:1, priceTiers:[{ quantity:12,price:6,packagingId:'case12' }] }),
  ]);
  assert.equal(result.length,3); assert.equal(result[0].shopName,'Dhamecha');
  assert.equal(result[0].unitsIncluded,12); assert.equal(result[0].packagePrice,4.79);
  assert.equal(result[0].effectiveUnitPrice,4.79/12); assert.match(result[0].label,/Case of 12/);
  assert.equal(result[1].effectiveUnitPrice,0.5); assert.match(result[1].label,/Case of 12/);
  assert.equal(result[1].hasActiveOffer,false); assert.equal(result[2].packagePrice,0.6);
});
test('null promotion metadata does not invent an offer label even when current differs from regular', () => {
  const [result] = options([shop({price:8.49,effectivePrice:4.79,unitsPerPack:12,isSupplierCurrentPrice:true})]);
  assert.equal(result.hasActiveOffer,false); assert.doesNotMatch(result.label,/offer/); assert.match(result.detail,/4.79/);
});
test('legacy quantity tiers remain quantities of the base priced pack', () => {
  const result = options([shop({ price:6,effectivePrice:6,unitsPerPack:12,priceTiers:[{quantity:2,price:10}] })]);
  assert.equal(result[0].unitsIncluded,24); assert.equal(result[0].effectiveUnitPrice,10/24);
});
test('ranking retains fractional pence until display formatting', () => {
  const result = options([shop({productAtShopId:'a',effectivePrice:5.99,unitsPerPack:12}),shop({productAtShopId:'b',effectivePrice:6,unitsPerPack:12})]);
  assert.equal(result[0].isBestValue,true); assert.equal(result[1].isBestValue,false);
});
