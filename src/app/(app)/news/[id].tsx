import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/ui/skeleton';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { formatNewsDate } from '@/features/home/components/news-card';
import { useNewsItem } from '@/features/home/hooks/use-home';

/** Full news article, rendered in-app. Cached articles reopen instantly. */
export default function NewsArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: article, isLoading } = useNewsItem(id ?? '');

  const openSource = async () => {
    if (!article?.sourceUrl) return;
    // In-app browser sheet, not an external redirect.
    await WebBrowser.openBrowserAsync(article.sourceUrl).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          {article?.imageUrl ? (
            <Animated.View entering={FadeIn.duration(240)} style={styles.hero}>
              <Image
                source={{ uri: article.imageUrl }}
                style={styles.heroImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={220}
              />
            </Animated.View>
          ) : (
            <View style={[styles.hero, styles.heroFallback]}>
              <Ionicons name="newspaper-outline" size={40} color={Colors.light.textLight} />
            </View>
          )}
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={[styles.backButton, { top: insets.top + 10 }]}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.duration(320)} style={styles.body}>
          {isLoading && !article ? (
            <View style={{ gap: Spacing.sm }}>
              <Skeleton width="90%" height={24} />
              <Skeleton width="40%" height={14} />
              <Skeleton width="100%" height={14} />
              <Skeleton width="100%" height={14} />
              <Skeleton width="70%" height={14} />
            </View>
          ) : article ? (
            <>
              <Text style={styles.title}>{article.title}</Text>
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={13} color={Colors.light.textSecondary} />
                <Text style={styles.date}>{formatNewsDate(article.publishedAt)}</Text>
              </View>
              <Text style={styles.content}>{article.description}</Text>

              {!!article.sourceUrl && (
                <Pressable
                  onPress={openSource}
                  style={({ pressed }) => [styles.sourceLink, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="globe-outline" size={15} color={Colors.light.primary} />
                  <Text style={styles.sourceText}>View original source</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Text style={styles.content}>Article not found.</Text>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  heroWrap: {
    width: '100%',
  },
  hero: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 20, 8, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    color: Colors.light.text,
    lineHeight: 32,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  date: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  content: {
    ...Typography.body,
    color: Colors.light.text,
    lineHeight: 26,
    marginTop: Spacing.xs,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundCard,
  },
  sourceText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.primary,
  },
});
