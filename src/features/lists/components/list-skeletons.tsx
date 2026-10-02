import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';

const BAND_WIDTH = 140;

/** Card shell matching the real row, with a light band sweeping across it. */
function ShimmerCard({ style, children }: { style: ViewStyle; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  const bandStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -BAND_WIDTH + progress.get() * (width + BAND_WIDTH) },
      { skewX: '-20deg' },
    ],
  }));

  return (
    <View style={style}>
      {children}
      {/* Separate clip layer so the card keeps its iOS shadow. */}
      <View style={styles.clip}>
        <Animated.View style={[styles.band, bandStyle]}>
          <View style={[styles.bandStrip, { opacity: 0.25 }]} />
          <View style={[styles.bandStrip, { opacity: 0.55 }]} />
          <View style={[styles.bandStrip, { opacity: 0.25 }]} />
        </Animated.View>
      </View>
    </View>
  );
}

function Block({ width, height, radius = 6, style }: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  return <View style={[styles.block, { width, height, borderRadius: radius }, style]} />;
}

/** Placeholder for the Shopping Lists tab, laid out exactly like `ListCard`. */
export function ListCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.stack} accessible accessibilityLabel="Loading lists">
      {Array.from({ length: count }, (_, i) => (
        <ShimmerCard key={i} style={styles.listCard}>
          <Block width={48} height={48} radius={BorderRadius.md} />
          <View style={styles.listCardBody}>
            <View style={styles.line24}>
              <Block width={i % 2 ? '45%' : '60%'} height={14} />
            </View>
            <View style={styles.listCardMeta}>
              <Block width={68} height={22} radius={BorderRadius.full} />
              <Block width={84} height={10} />
            </View>
          </View>
          <Block width={18} height={18} radius={BorderRadius.full} style={styles.listCardDelete} />
        </ShimmerCard>
      ))}
    </View>
  );
}

/** Placeholder for list details, laid out exactly like `ListProductRow`. */
export function ListProductRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.stack} accessible accessibilityLabel="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <ShimmerCard key={i} style={styles.productCard}>
          <Block width={56} height={56} radius={BorderRadius.md} />
          <View style={styles.productBody}>
            <View style={styles.line20}>
              <Block width={i % 2 ? '55%' : '75%'} height={12} />
            </View>
            <View style={styles.line20}>
              <Block width={56} height={12} />
            </View>
            <View style={styles.productControls}>
              <Block width={90} height={34} radius={BorderRadius.full} />
              <Block width={18} height={18} radius={BorderRadius.full} style={styles.productUrgent} />
              <Block width={16} height={16} radius={BorderRadius.full} style={styles.productRemove} />
            </View>
          </View>
        </ShimmerCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.sm,
  },
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  band: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: BAND_WIDTH,
    flexDirection: 'row',
  },
  bandStrip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  block: {
    backgroundColor: Colors.light.border,
  },
  line24: {
    height: 24,
    justifyContent: 'center',
  },
  line20: {
    height: 20,
    justifyContent: 'center',
  },
  // Mirrors ListCard styles.
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  listCardBody: {
    flex: 1,
    gap: 6,
  },
  listCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  listCardDelete: {
    marginHorizontal: 8,
  },
  // Mirrors ListProductRow styles.
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.sm,
    ...Shadows.sm,
  },
  productBody: {
    flex: 1,
    gap: 4,
  },
  productControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  productUrgent: {
    marginLeft: 'auto',
    marginHorizontal: 6,
  },
  productRemove: {
    marginHorizontal: 7,
  },
});
