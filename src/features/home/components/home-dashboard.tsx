import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Colors, Shadows } from '@/constants/theme';
import type { NewsItem } from '../types';
import { HomeAction } from './home-action';
import { NewsCard } from './news-card';

const c = Colors.light;
const goldInk = '#79551F';
const softBorder = '#EAE3D7';

export function HomeHeader({
  firstName,
  shopName,
  onOpenShop,
}: {
  firstName: string;
  shopName: string;
  onOpenShop: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.welcome}>
        <View style={styles.welcomeAccent} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={styles.greeting}>Hi {firstName}</Text>
          <Text style={styles.subtitle}>Here’s what’s new today</Text>
        </View>
      </View>
      <HomeAction
        label={`Current shop: ${shopName}. Switch supermarket`}
        hint="Opens your supermarkets so you can choose another shop"
        onPress={onOpenShop}
        style={styles.shopSelector}
      >
        <View style={styles.shopIcon}><Ionicons name="storefront-outline" size={21} color={goldInk} /></View>
        <View style={styles.flex}>
          <Text style={styles.shopEyebrow}>CURRENT SHOP</Text>
          <Text style={styles.shopName}>{shopName}</Text>
        </View>
        <View style={styles.switchIcon}><Ionicons name="swap-horizontal" size={19} color={goldInk} /></View>
      </HomeAction>
    </View>
  );
}

export function ShopRecoveryCard({ message, onPress }: { message: string; onPress: () => void }) {
  return (
    <View style={styles.inset}>
      <HomeAction label="Open your shop workspace" hint={message} onPress={onPress} style={styles.shopRecovery}>
        <Ionicons name="storefront-outline" size={23} color={goldInk} />
        <View style={styles.flex}>
          <Text style={styles.recoveryTitle}>Open your shop workspace</Text>
          <Text style={styles.recoveryMessage}>{message}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={goldInk} />
      </HomeAction>
    </View>
  );
}

export function HomeSectionHeading({
  title,
  description,
  updated = false,
}: {
  title: string;
  description?: string;
  updated?: boolean;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.flex}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        {!!description && <Text style={styles.sectionDescription}>{description}</Text>}
      </View>
      {updated && (
        <View style={styles.updatedPill}>
          <View style={styles.updatedDot} />
          <Text style={styles.updatedText}>Updated</Text>
        </View>
      )}
    </View>
  );
}

export function HomeQuickActions({
  onCompare,
  onPromotions,
  onReportPrice,
}: {
  onCompare: () => void;
  onPromotions: () => void;
  onReportPrice: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3 || (width < 360 && fontScale > 1.1);

  return (
    <View style={styles.quickSection}>
      <HomeSectionHeading title="Quick actions" />
      <View style={[styles.quickLayout, stacked && styles.quickStacked]}>
        <View style={styles.flex}>
          <HomeAction label="Compare Products" onPress={onCompare} style={styles.compareCard}>
            <View style={styles.compareTop}>
              <View style={styles.compareIcon}><Ionicons name="git-compare-outline" size={25} color={c.accent} /></View>
              <Ionicons name="arrow-forward" size={19} color={c.accent} />
            </View>
            <Text style={styles.compareLabel}>Compare Products</Text>
          </HomeAction>
        </View>
        <View style={styles.secondaryActions}>
          <HomeAction label="Promotions" onPress={onPromotions} style={[styles.secondaryCard, width < 360 && styles.secondaryCardCompact]}>
            <View style={styles.quickIcon}><Ionicons name="pricetags-outline" size={21} color={goldInk} /></View>
            <Text style={styles.quickLabel}>Promotions</Text>
          </HomeAction>
          <HomeAction label="Report Price" onPress={onReportPrice} style={[styles.secondaryCard, width < 360 && styles.secondaryCardCompact]}>
            <View style={styles.quickIcon}><Ionicons name="pricetag-outline" size={21} color={goldInk} /></View>
            <Text style={styles.quickLabel}>Report Price</Text>
          </HomeAction>
        </View>
      </View>
    </View>
  );
}

/** Six existing previews, presented as a horizontal collection without new pagination. */
export function HomeNewsRail({ items, onPress }: { items: NewsItem[]; onPress: (item: NewsItem) => void }) {
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const availableWidth = measuredWidth || Math.min(width, 720);
  const cardWidth = Math.min(fontScale > 1.3 ? 380 : 310, Math.max(1, availableWidth - 60));

  return (
    <View onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        accessibilityLabel="Daily News articles"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.newsRail}
        snapToInterval={cardWidth + 12}
        snapToAlignment="start"
        decelerationRate="fast"
        directionalLockEnabled
      >
        {items.map((item) => (
          <View key={item.id} style={{ width: cardWidth }}>
            <NewsCard item={item} onPress={onPress} />
          </View>
        ))}
      </ScrollView>
      {items.length > 1 && (
        <View style={styles.railHint}>
          <View style={styles.railHintLine} />
          <Text style={styles.railHintText}>Swipe for more news</Text>
          <Ionicons name="arrow-forward" size={14} color={c.textSecondary} />
        </View>
      )}
    </View>
  );
}

export function HomeNewsLoading() {
  return (
    <View style={styles.newsLoading} accessible accessibilityLabel="Loading news" accessibilityState={{ busy: true }}>
      <Skeleton width="100%" height={160} radius={18} />
      <View style={styles.loadingLines}>
        <Skeleton width="86%" height={18} />
        <Skeleton width="65%" height={18} />
        <Skeleton width="100%" height={12} />
        <Skeleton width="70%" height={12} />
      </View>
    </View>
  );
}

export function HomeNewsEmpty() {
  return (
    <View style={styles.emptyNews}>
      <View style={styles.emptyNewsIcon}><Ionicons name="newspaper-outline" size={28} color={goldInk} /></View>
      <Text style={styles.emptyNewsText}>No news yet — check back later.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  inset: { paddingHorizontal: 20 },
  header: { paddingHorizontal: 20, gap: 18 },
  welcome: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  welcomeAccent: { width: 4, height: 38, borderRadius: 2, backgroundColor: c.primary },
  greeting: { fontSize: 29, lineHeight: 36, fontWeight: '700', letterSpacing: -0.8, color: c.text },
  subtitle: { fontSize: 13, lineHeight: 20, color: c.textSecondary, marginTop: 2 },
  shopSelector: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 19, padding: 13, minHeight: 74, backgroundColor: c.backgroundCard, borderWidth: 1, borderColor: softBorder },
  shopIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primaryLight },
  shopEyebrow: { fontSize: 9, lineHeight: 14, fontWeight: '700', letterSpacing: 1.1, color: c.textSecondary },
  shopName: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: c.text, marginTop: 2 },
  switchIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.backgroundSecondary },
  shopRecovery: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: c.primaryLight, borderRadius: 18, borderWidth: 1, borderColor: c.border },
  recoveryTitle: { color: c.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  recoveryMessage: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { color: c.text, fontSize: 19, lineHeight: 26, fontWeight: '700', letterSpacing: -0.4 },
  sectionDescription: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  updatedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: c.primaryLight },
  updatedDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: goldInk },
  updatedText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: goldInk },
  quickSection: { paddingHorizontal: 20, gap: 12 },
  quickLayout: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  quickStacked: { flexDirection: 'column' },
  compareCard: { flex: 1, minWidth: 0, minHeight: 154, padding: 18, borderRadius: 22, backgroundColor: c.text, justifyContent: 'space-between', gap: 20, ...Shadows.sm },
  compareTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  compareIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#453C2E' },
  compareLabel: { fontSize: 19, lineHeight: 25, fontWeight: '600', color: c.backgroundSecondary, letterSpacing: -0.3 },
  secondaryActions: { flex: 1, minWidth: 0, gap: 10 },
  secondaryCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 72, padding: 12, borderRadius: 19, backgroundColor: c.backgroundCard, borderWidth: 1, borderColor: softBorder },
  secondaryCardCompact: { paddingHorizontal: 10, gap: 6 },
  quickIcon: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: c.backgroundSecondary },
  quickLabel: { fontSize: 13, lineHeight: 19, color: c.text, fontWeight: '600', flex: 1, minWidth: 0 },
  newsRail: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 6, gap: 12, alignItems: 'stretch' },
  railHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 20, paddingTop: 8 },
  railHintLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginRight: 4 },
  railHintText: { color: c.textSecondary, fontSize: 11, lineHeight: 17 },
  newsLoading: { marginHorizontal: 20, borderRadius: 22, backgroundColor: c.backgroundCard, borderWidth: 1, borderColor: softBorder, padding: 6, gap: 10 },
  loadingLines: { gap: 8, padding: 12 },
  emptyNews: { marginHorizontal: 20, padding: 26, gap: 12, borderWidth: 1, borderColor: softBorder, borderRadius: 22, backgroundColor: c.backgroundCard, alignItems: 'center' },
  emptyNewsIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: c.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  emptyNewsText: { color: c.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
