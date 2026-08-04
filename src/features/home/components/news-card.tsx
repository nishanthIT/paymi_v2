import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';

import type { NewsItem } from '../types';

interface NewsCardProps {
  item: NewsItem;
  onPress: (item: NewsItem) => void;
}

export function formatNewsDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Compact, scannable news card: cover left, text right. */
export function NewsCard({ item, onPress }: NewsCardProps) {
  // Article bodies can contain many newlines; collapse for the 2-line preview.
  const preview = (item.description ?? '').replace(/\s+/g, ' ').trim();

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.coverWrap}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={item.id}
            transition={200}
          />
        ) : (
          <View style={styles.coverFallback}>
            <Ionicons name="newspaper-outline" size={24} color={Colors.light.textLight} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {preview}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.date}>{formatNewsDate(item.publishedAt)}</Text>
          <View style={styles.readMore}>
            <Text style={styles.readMoreText}>Read more</Text>
            <Ionicons name="chevron-forward" size={12} color={Colors.light.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 108,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.sm,
    ...Shadows.sm,
  },
  pressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  coverWrap: {
    width: 92,
    height: 92,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundSecondary,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    height: '100%',
  },
  title: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.text,
    lineHeight: 18,
  },
  description: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  date: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textLight,
  },
  readMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  readMoreText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.primary,
  },
});
