import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';

import type { Advertisement } from '../types';

interface AdCarouselProps {
  ads: Advertisement[];
  loading?: boolean;
  onPressAd: (ad: Advertisement) => void;
}

const AUTO_SCROLL_MS = 2800;
// Wide banner ratio keeps the hero compact so content below stays visible.
const ASPECT_RATIO = 1.91;
// Data is tripled so the list can loop seamlessly in both directions.
const LOOP_COPIES = 3;

/**
 * Full-width hero carousel: auto-scrolls every ~3s, loops infinitely,
 * pauses while the user is touching, and caches images on disk.
 */
export function AdCarousel({ ads, loading, onPressAd }: AdCarouselProps) {
  const { width } = useWindowDimensions();
  const cardWidth = width - Spacing.lg * 2;
  const cardHeight = Math.round(cardWidth / ASPECT_RATIO);

  const listRef = useRef<FlatList>(null);
  const indexRef = useRef(0);
  const interactingRef = useRef(false);
  const [activeDot, setActiveDot] = useState(0);

  const looping = ads.length > 1;
  const data = useMemo(
    () => (looping ? Array.from({ length: LOOP_COPIES }, () => ads).flat() : ads),
    [ads, looping],
  );
  const middleStart = looping ? ads.length : 0;

  // Start in the middle copy so the user can swipe backwards immediately.
  useEffect(() => {
    if (!looping) return;
    indexRef.current = middleStart;
    const id = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: middleStart * width, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [looping, middleStart, width, ads]);

  const advance = useCallback(() => {
    if (!looping || interactingRef.current) return;
    const next = indexRef.current + 1;
    listRef.current?.scrollToOffset({ offset: next * width, animated: true });
  }, [looping, width]);

  useEffect(() => {
    if (!looping) return;
    const id = setInterval(advance, AUTO_SCROLL_MS);
    return () => clearInterval(id);
  }, [advance, looping]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!looping) return;
    let index = Math.round(event.nativeEvent.contentOffset.x / width);
    // Silently re-centre into the middle copy when reaching either edge copy.
    if (index < ads.length || index >= ads.length * 2) {
      index = ads.length + (index % ads.length);
      listRef.current?.scrollToOffset({ offset: index * width, animated: false });
    }
    indexRef.current = index;
    setActiveDot(index % ads.length);
    interactingRef.current = false;
  };

  if (loading && ads.length === 0) {
    return (
      <View style={{ paddingHorizontal: Spacing.lg }}>
        <Skeleton width="100%" height={cardHeight} radius={BorderRadius.xl} />
      </View>
    );
  }

  if (ads.length === 0) return null;

  return (
    <View>
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onScrollBeginDrag={() => {
          interactingRef.current = true;
        }}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEnabled={looping}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: Spacing.lg }}>
            <Pressable
              onPress={() => onPressAd(item)}
              style={({ pressed }) => [
                styles.card,
                { height: cardHeight },
                pressed && { opacity: 0.92 },
              ]}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={item.id}
                transition={220}
                placeholderContentFit="cover"
              />
            </Pressable>
          </View>
        )}
      />

      {ads.length > 1 && (
        <View style={styles.dots}>
          {ads.map((ad, index) => (
            <View
              key={ad.id}
              style={[styles.dot, index === activeDot && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundSecondary,
    ...Shadows.md,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.border,
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
  },
});
