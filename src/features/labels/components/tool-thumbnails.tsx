import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LabelTokens as T } from '../tokens';
import { ThumbSurface } from './tool-card';

/**
 * Miniature fixture artwork for the six landing cards (spec §3 thumbnails).
 * Deterministic decorative pieces for catalogue display only — real artwork
 * comes from the shared renderer in later batches and never from these.
 */

/** Deterministic fixture bar pattern — display-only, not an encoded barcode. */
export function MiniBarcode({ width = 44, height = 14, seed = 7 }: { width?: number; height?: number; seed?: number }) {
  const bars: React.ReactNode[] = [];
  let x = 0;
  let value = seed;
  let index = 0;
  while (x < width - 2) {
    value = (value * 33 + 7) % 97;
    const barW = 1 + (value % 3);
    bars.push(<View key={index} style={{ width: barW, height, backgroundColor: T.ink, marginRight: 1 }} />);
    x += barW + 1;
    index += 1;
  }
  return <View style={miniStyles.barcodeRow}>{bars}</View>;
}

/** SEL · Standard — name above, barcode lower-left, big price with raised pence. */
export function ThumbSelStandard() {
  return (
    <ThumbSurface style={miniStyles.selLabel}>
      <Text style={miniStyles.selName} numberOfLines={1}>
        Mud House Sauvignon Blanc 75cl
      </Text>
      <View style={miniStyles.selBottomRow}>
        <MiniBarcode width={34} height={12} />
        <View style={miniStyles.priceRow}>
          <Text style={miniStyles.selPrice}>£8.</Text>
          <Text style={miniStyles.selPence}>75</Text>
        </View>
      </View>
    </ThumbSurface>
  );
}

/** SEL · Promo — white info half, yellow "2 FOR £16" half. */
export function ThumbSelPromo() {
  return (
    <ThumbSurface style={miniStyles.promoLabel}>
      <View style={miniStyles.promoLeft}>
        <Text style={miniStyles.promoName} numberOfLines={2}>
          Mud House{'\n'}Sauvignon Blanc
        </Text>
        <Text style={miniStyles.promoEach} numberOfLines={1}>
          <Text style={miniStyles.strike}>£11.25</Text> Each £8.75
        </Text>
        <MiniBarcode width={30} height={8} seed={3} />
      </View>
      <View style={miniStyles.promoRight}>
        <Text style={miniStyles.promoOfferTop}>2 FOR</Text>
        <Text style={miniStyles.promoOfferPrice}>£16</Text>
      </View>
    </ThumbSurface>
  );
}

/** Reduced sticker — yellow REDUCED, barcode, was/now prices. */
export function ThumbReduced() {
  return (
    <ThumbSurface style={miniStyles.reducedLabel}>
      <Text style={miniStyles.reducedTitle}>REDUCED</Text>
      <MiniBarcode width={40} height={9} seed={11} />
      <View style={miniStyles.reducedPriceRow}>
        <Text style={[miniStyles.reducedWas, miniStyles.strike]}>£13.69</Text>
        <Text style={miniStyles.reducedNow}>£7.99</Text>
      </View>
    </ThumbSurface>
  );
}

/** Shelf talker — red top banner, name/price left, product image right. */
export function ThumbShelfTalker() {
  return (
    <ThumbSurface style={miniStyles.talkerLabel}>
      <View style={miniStyles.talkerBanner} />
      <View style={miniStyles.talkerBody}>
        <View style={miniStyles.talkerText}>
          <Text style={miniStyles.talkerName} numberOfLines={1}>
            Sample product
          </Text>
          <Text style={miniStyles.talkerPrice}>£1.99</Text>
        </View>
        <View style={miniStyles.talkerImage}>
          <View style={miniStyles.bottleBody} />
          <View style={miniStyles.bottleNeck} />
        </View>
      </View>
    </ThumbSurface>
  );
}

/** Shelf liner — red SALE strip with white offer typography and percentage. */
export function ThumbShelfRunner() {
  return (
    <View style={miniStyles.runnerStrip}>
      <Text style={miniStyles.runnerSale}>SALE</Text>
      <Text style={miniStyles.runnerPct}>UP TO 50% OFF</Text>
    </View>
  );
}

/** Mixed size label — portrait sheet holding visibly different label sizes. */
export function ThumbMixedSheet() {
  return (
    <ThumbSurface style={miniStyles.mixedPage}>
      <View style={[miniStyles.mixedBlock, { width: '92%', height: 13 }]} />
      <View style={[miniStyles.mixedBlock, { width: '68%', height: 13 }]} />
      <View style={miniStyles.mixedRow}>
        <View style={[miniStyles.mixedBlock, { flex: 1, height: 12 }]} />
        <View style={[miniStyles.mixedBlock, { flex: 1, height: 12 }]} />
      </View>
    </ThumbSurface>
  );
}

const miniStyles = StyleSheet.create({
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  strike: {
    textDecorationLine: 'line-through',
  },

  selLabel: {
    width: 88,
    height: 50,
    borderRadius: 2,
    paddingHorizontal: 5,
    paddingVertical: 4,
    justifyContent: 'space-between',
  },
  selName: {
    fontSize: 5.5,
    fontWeight: '700',
    color: T.ink,
    textAlign: 'center',
  },
  selBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  selPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.5,
  },
  selPence: {
    fontSize: 9,
    fontWeight: '800',
    color: T.ink,
    marginTop: 1,
  },

  promoLabel: {
    width: 92,
    height: 52,
    borderRadius: 2,
    flexDirection: 'row',
  },
  promoLeft: {
    flex: 1.15,
    backgroundColor: T.surface,
    paddingHorizontal: 4,
    paddingVertical: 3,
    justifyContent: 'space-between',
  },
  promoName: {
    fontSize: 5,
    fontWeight: '700',
    color: T.ink,
  },
  promoEach: {
    fontSize: 4.6,
    fontWeight: '700',
    color: T.ink,
  },
  promoRight: {
    flex: 1,
    backgroundColor: T.promoLabelYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoOfferTop: {
    fontSize: 10,
    fontWeight: '800',
    color: T.ink,
  },
  promoOfferPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: T.ink,
    marginTop: -1,
  },

  reducedLabel: {
    width: 84,
    height: 52,
    borderRadius: 2,
    backgroundColor: T.promoLabelYellow,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  reducedTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: 0.5,
  },
  reducedPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  reducedWas: {
    fontSize: 6,
    fontWeight: '600',
    color: T.ink,
  },
  reducedNow: {
    fontSize: 11,
    fontWeight: '800',
    color: T.ink,
  },

  talkerLabel: {
    width: 96,
    height: 44,
    borderRadius: 2,
  },
  talkerBanner: {
    height: 9,
    backgroundColor: T.promoRed,
  },
  talkerBody: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  talkerText: {
    flex: 1,
  },
  talkerName: {
    fontSize: 5.5,
    fontWeight: '700',
    color: T.ink,
  },
  talkerPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: T.ink,
  },
  talkerImage: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 24,
  },
  bottleBody: {
    position: 'absolute',
    bottom: 0,
    width: 12,
    height: 16,
    borderRadius: 2,
    backgroundColor: T.promoRed,
  },
  bottleNeck: {
    position: 'absolute',
    bottom: 14,
    width: 5,
    height: 7,
    borderRadius: 1,
    backgroundColor: T.promoRed,
  },

  runnerStrip: {
    width: 96,
    height: 26,
    backgroundColor: T.promoRed,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  runnerSale: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  runnerPct: {
    fontSize: 6,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  mixedPage: {
    width: 56,
    height: 72,
    borderRadius: 2,
    paddingHorizontal: 3,
    paddingVertical: 4,
    gap: 3,
  },
  mixedRow: {
    flexDirection: 'row',
    gap: 3,
  },
  mixedBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.accent,
    backgroundColor: T.accentSoft,
    borderRadius: 1.5,
    alignSelf: 'center',
  },
});
