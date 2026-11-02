import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ImageViewer } from '@/components/ui/image-viewer';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { AdCarousel } from '@/features/home/components/ad-carousel';
import {
  HomeHeader,
  HomeNewsEmpty,
  HomeNewsLoading,
  HomeNewsRail,
  HomeQuickActions,
  HomeSectionHeading,
  ShopRecoveryCard,
} from '@/features/home/components/home-dashboard';
import { useAdvertisements, useNews, usePromotions } from '@/features/home/hooks/use-home';
import { usePullToRefresh } from '@/hooks/use-query-refresh';

const NEWS_PREVIEW_COUNT = 6;

/** Home: hero ad carousel, quick actions and the latest news. */
export default function HomeScreen() {
  const { user, activeSupermarket, shopsError, refreshSupermarkets } = useAuth();
  const router = useRouter();

  const ads = useAdvertisements();
  const news = useNews();
  const promotions = usePromotions();

  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const shopName = activeSupermarket?.name ?? 'My Supermarkets';
  const newsItems = news.data?.slice(0, NEWS_PREVIEW_COUNT) ?? [];

  const { refetch: refetchAds } = ads;
  const { refetch: refetchNews } = news;
  const { refetch: refetchPromotions } = promotions;
  const refetchAll = useCallback(
    () => Promise.all([refetchAds(), refetchNews(), refetchPromotions(), refreshSupermarkets()]),
    [refetchAds, refetchNews, refetchPromotions, refreshSupermarkets],
  );
  const anyPaused = [ads, news, promotions].some((q) => q.fetchStatus === 'paused');
  const { refreshing, onRefresh } = usePullToRefresh(refetchAll, anyPaused ? 'paused' : 'idle');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
        <Animated.View entering={FadeInDown.duration(280).reduceMotion(ReduceMotion.System)}>
          <HomeHeader
            firstName={firstName}
            shopName={shopName}
            onOpenShop={() => router.push('/(app)/supermarkets')}
          />
        </Animated.View>

        {(shopsError || !activeSupermarket) && (
          <ShopRecoveryCard
            message={shopsError || 'Choose a shop to access its lists, people and daily records.'}
            onPress={() => router.push('/(app)/supermarkets')}
          />
        )}

        <Animated.View entering={FadeInDown.duration(280).delay(40).reduceMotion(ReduceMotion.System)}>
          <HomeQuickActions
            onCompare={() => router.push('/(app)/compare-products')}
            onPromotions={() => router.push('/promotions')}
            onReportPrice={() => router.push('/(app)/report-price')}
          />
        </Animated.View>

        {(ads.isLoading || (ads.data?.length ?? 0) > 0) && (
          <Animated.View entering={FadeInDown.duration(280).delay(80).reduceMotion(ReduceMotion.System)} style={styles.section}>
            <View style={styles.sectionInset}>
              <HomeSectionHeading title="In the spotlight" description="The latest from your retail community." />
            </View>
            <AdCarousel
              ads={ads.data ?? []}
              loading={ads.isLoading}
              onPressAd={(ad) => setViewerUri(ad.imageUrl)}
            />
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.duration(280).delay(120).reduceMotion(ReduceMotion.System)} style={styles.section}>
          <View style={styles.sectionInset}>
            <HomeSectionHeading title="Daily News" description="A fresh perspective for your business." updated={newsItems.length > 0} />
          </View>
          {news.isLoading && newsItems.length === 0 ? (
            <HomeNewsLoading />
          ) : newsItems.length === 0 ? (
            <HomeNewsEmpty />
          ) : (
            <HomeNewsRail
              items={newsItems}
              onPress={(article) =>
                router.push({ pathname: '/(app)/news/[id]', params: { id: article.id } })
              }
            />
          )}
        </Animated.View>
      </ScrollView>

      <ImageViewer uri={viewerUri} visible={!!viewerUri} onClose={() => setViewerUri(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingTop: 20,
    paddingBottom: 32,
    gap: 26,
  },
  section: { gap: 12 },
  sectionInset: { paddingHorizontal: 20 },
});
