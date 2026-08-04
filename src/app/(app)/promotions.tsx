import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ImageViewer } from '@/components/ui/image-viewer';
import { Skeleton } from '@/components/ui/skeleton';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { PromotionCard } from '@/features/home/components/promotion-card';
import { usePromotions } from '@/features/home/hooks/use-home';

/** All active promotions with image zoom and per-promotion product lists. */
export default function PromotionsScreen() {
  const router = useRouter();
  const { data: promotions, isLoading, refetch, isRefetching } = usePromotions();
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Promotions</Text>
          <Text style={styles.headerMeta}>Current offers from your wholesalers</Text>
        </View>
      </View>

      <FlatList
        data={promotions ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        initialNumToRender={4}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.light.primary}
            colors={[Colors.light.primary]}
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index * 60, 300))}>
            <PromotionCard
              promotion={item}
              onPressImage={setViewerUri}
              onViewProducts={(promotion) =>
                router.push({ pathname: '/(app)/promotion/[id]', params: { id: promotion.id } })
              }
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.skeletons}>
              <Skeleton width="100%" height={210} radius={BorderRadius.xl} />
              <Skeleton width="100%" height={210} radius={BorderRadius.xl} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="pricetags-outline" size={40} color={Colors.light.textLight} />
              <Text style={styles.emptyTitle}>No promotions right now</Text>
              <Text style={styles.emptyText}>Check back soon — new offers land regularly.</Text>
            </View>
          )
        }
      />

      <ImageViewer uri={viewerUri} visible={!!viewerUri} onClose={() => setViewerUri(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.light.text,
  },
  headerMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  skeletons: {
    gap: Spacing.md,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.bodyBold,
    color: Colors.light.text,
    marginTop: Spacing.xs,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
