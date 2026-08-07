import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ImageViewer } from '@/components/ui/image-viewer';
import { Skeleton } from '@/components/ui/skeleton';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { AdCarousel } from '@/features/home/components/ad-carousel';
import { NewsCard } from '@/features/home/components/news-card';
import { useAdvertisements, useNews, usePromotions } from '@/features/home/hooks/use-home';

const NEWS_PREVIEW_COUNT = 6;

/** Home: hero ad carousel, quick actions and the latest news. */
export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const ads = useAdvertisements();
  const news = useNews();
  const promotions = usePromotions();

  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const newsItems = news.data?.slice(0, NEWS_PREVIEW_COUNT) ?? [];

  const refreshing = ads.isRefetching || news.isRefetching || promotions.isRefetching;
  const onRefresh = useCallback(() => {
    ads.refetch();
    news.refetch();
    promotions.refetch();
  }, [ads, news, promotions]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.light.primary}
            colors={[Colors.light.primary]}
          />
        }
      >
        <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
          <Text style={styles.greeting}>Hi {firstName} </Text>
          <Text style={styles.subtitle}>Here’s what’s new today</Text>
        </Animated.View>

        {/* Hero advertisements */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <AdCarousel
            ads={ads.data ?? []}
            loading={ads.isLoading}
            onPressAd={(ad) => setViewerUri(ad.imageUrl)}
          />
        </Animated.View>

        {/* Quick actions */}
        <Animated.View entering={FadeInDown.duration(400).delay(160)} style={styles.quickRow}>
          <QuickAction
            icon="git-compare"
            label="Compare Products"
            onPress={() => router.push('/(app)/compare-products')}
          />
          <QuickAction
            icon="pricetags"
            label="Promotions"
            onPress={() => router.push('/(app)/promotions')}
          />
          <QuickAction
            icon="pricetag"
            label="Report Price"
            onPress={() => router.push('/(app)/report-price')}
          />
        </Animated.View>

        {/* Daily news */}
        <Animated.View entering={FadeInDown.duration(400).delay(240)} style={styles.newsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Daily News</Text>
            </View>
            {newsItems.length > 0 && (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Updated</Text>
              </View>
            )}
          </View>

          {news.isLoading && newsItems.length === 0 ? (
            <View style={styles.newsList}>
              <Skeleton width="100%" height={108} radius={BorderRadius.lg} />
              <Skeleton width="100%" height={108} radius={BorderRadius.lg} />
            </View>
          ) : newsItems.length === 0 ? (
            <View style={styles.emptyNews}>
              <Ionicons name="newspaper-outline" size={28} color={Colors.light.textLight} />
              <Text style={styles.emptyNewsText}>No news yet — check back later.</Text>
            </View>
          ) : (
            <View style={styles.newsList}>
              {newsItems.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  onPress={(article) =>
                    router.push({ pathname: '/(app)/news/[id]', params: { id: article.id } })
                  }
                />
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <ImageViewer uri={viewerUri} visible={!!viewerUri} onClose={() => setViewerUri(null)} />
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickCard, pressed && styles.quickPressed]}
    >
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={24} color={Colors.light.primary} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
    color: Colors.light.text,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  quickCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: 4,
    ...Shadows.sm,
  },
  quickPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  newsSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.light.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    color: Colors.light.text,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: '#EAF5EB',
    borderWidth: 1,
    borderColor: '#C4E2C5',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.success,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
    color: Colors.light.success,
  },
  newsList: {
    gap: Spacing.sm,
  },
  emptyNews: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  emptyNewsText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
});

