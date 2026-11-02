import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type FlatListInstance,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Colors, Shadows } from '@/constants/theme';

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
const PAGE_GUTTER = 20;

/**
 * Hero carousel: auto-scrolls every ~3s, loops infinitely,
 * pauses during dragging, and caches images on disk.
 */
export function AdCarousel({ ads, loading, onPressAd }: AdCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  // Paging follows the actual safe-area/content width, including on tablets.
  const width = containerWidth || windowWidth;
  const cardWidth = Math.max(1, width - PAGE_GUTTER * 2);
  const cardHeight = Math.round(cardWidth / ASPECT_RATIO);
  const measureContainer = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) setContainerWidth(nextWidth);
  }, []);

  const listRef = useRef<FlatListInstance>(null);
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
      <View onLayout={measureContainer} style={styles.loading}>
        <Skeleton width="100%" height={cardHeight + 58} radius={24} />
      </View>
    );
  }

  if (ads.length === 0) return null;

  return (
    <View onLayout={measureContainer} style={styles.container}>
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
          <View style={[styles.page, { width }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.title ? `View image: ${item.title}` : 'View advertisement image'}
              accessibilityHint="Opens the full-screen image viewer"
              onPress={() => onPressAd(item)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={[styles.image, { height: cardHeight }]}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={item.id}
                transition={220}
                placeholderContentFit="cover"
                accessible={false}
              />
              <View style={styles.caption}>
                <Text style={styles.captionTitle} numberOfLines={2}>{item.title || 'View image'}</Text>
                <View style={styles.expandIcon}>
                  <Ionicons name="expand-outline" size={17} color="#79551F" />
                </View>
              </View>
            </Pressable>
          </View>
        )}
      />

      {ads.length > 1 && (
        <View style={styles.pagination}>
          <View style={styles.dots} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {ads.map((ad, index) => (
              <View
                key={ad.id}
                style={[styles.dot, index === activeDot && styles.dotActive]}
              />
            ))}
          </View>
          <Text style={styles.pageCount} accessibilityLabel={`Advertisement ${activeDot + 1} of ${ads.length}`}>
            {activeDot + 1} / {ads.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  loading: { width: '100%', paddingHorizontal: PAGE_GUTTER },
  page: { paddingHorizontal: PAGE_GUTTER, paddingBottom: 3 },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EAE3D7',
    backgroundColor: Colors.light.backgroundCard,
    ...Shadows.sm,
  },
  pressed: { opacity: 0.92 },
  image: { width: '100%' },
  caption: { minHeight: 58, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  captionTitle: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19, fontWeight: '600', color: Colors.light.text },
  expandIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.backgroundSecondary },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: PAGE_GUTTER + 4, marginTop: 10 },
  dots: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.light.border },
  dotActive: { width: 22, backgroundColor: Colors.light.primary },
  pageCount: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: Colors.light.textSecondary, fontVariant: ['tabular-nums'] },
});
