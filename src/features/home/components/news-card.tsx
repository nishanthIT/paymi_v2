import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Shadows } from '@/constants/theme';

import type { NewsItem } from '../types';
import { HomeAction } from './home-action';

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

/** Editorial card for the Home news rail; the original article and preview stay intact. */
export function NewsCard({ item, onPress }: NewsCardProps) {
  // Article bodies can contain many newlines; collapse for the 2-line preview.
  const preview = (item.description ?? '').replace(/\s+/g, ' ').trim();

  return (
    <HomeAction
      label={item.title}
      hint={`${formatNewsDate(item.publishedAt)}. ${preview}. Read the full article`}
      onPress={() => onPress(item)}
      style={styles.card}
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
            <Ionicons name="newspaper-outline" size={38} color="#79551F" />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={3}>
          {item.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {preview}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.date}>{formatNewsDate(item.publishedAt)}</Text>
          <View style={styles.readMore}>
            <Text style={styles.readMoreText}>Read more</Text>
            <Ionicons name="arrow-forward" size={14} color="#79551F" />
          </View>
        </View>
      </View>
    </HomeAction>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EAE3D7',
    backgroundColor: Colors.light.backgroundCard,
    ...Shadows.sm,
  },
  coverWrap: {
    margin: 6,
    marginBottom: 0,
    aspectRatio: 1.8,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundSecondary,
  },
  cover: { width: '100%', height: '100%' },
  coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.primaryLight },
  body: { flex: 1, padding: 16, gap: 8 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.35, color: Colors.light.text },
  description: { fontSize: 13, lineHeight: 20, color: Colors.light.textSecondary },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 12,
  },
  date: { fontSize: 11, lineHeight: 16, color: Colors.light.textSecondary },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  readMoreText: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: '#79551F' },
});
