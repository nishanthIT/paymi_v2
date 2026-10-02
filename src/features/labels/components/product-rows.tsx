import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { needsPrice, validateItem, type LabelItem } from '../model/label-item';
import { formatMinor, parseMoneyText } from '../model/money';
import { LabelTokens as T } from '../tokens';
import { ScanSearchButtons } from './scan-search-buttons';

/** Products heading + count (printed instances, incl. extra facings). */
export function ProductsHeading({ count }: { count: number }) {
  return (
    <View style={styles.headingRow}>
      <Text style={styles.heading}>Products</Text>
      <Text style={styles.count}>{count}</Text>
    </View>
  );
}

/** Empty state (R21/R18): scanner illustration, exact copy, Scan/Search buttons. */
export function ProductsEmptyState({ onScan, onSearch }: { onScan: () => void; onSearch: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.illustration}>
        <MaterialCommunityIcons name="barcode-scan" size={46} color={T.textLight} />
        <MaterialCommunityIcons name="access-point" size={30} color={T.accent} />
      </View>
      <Text style={styles.emptyTitle}>Scan products to build a sheet</Text>
      <Text style={styles.emptyBody}>
        Point a handheld scanner at a barcode and it joins the sheet. Scan the same product again for a
        second facing. What you add is kept, so you can stop and come back.
      </Text>
      <View style={styles.emptyButtons}>
        <ScanSearchButtons onScan={onScan} onSearch={onSearch} />
      </View>
    </View>
  );
}

/** Filled product row (inferred — populated rows are unseen in the references). */
export function ProductRow({
  item,
  onPress,
  onRemove,
  onCopies,
}: {
  item: LabelItem;
  onPress: () => void;
  onRemove: () => void;
  /** Omit where copies live elsewhere (mixed-sheet slots): shows a remove button only. */
  onCopies?: (copies: number) => void;
}) {
  const snap = item.snapshot;
  const looking = item.lookup === 'looking_up';
  const price = parseMoneyText(item.priceText);
  const missingPrice = needsPrice(item);
  const otherErrors = Object.keys(validateItem(item)).filter((k) => k !== 'price').length > 0;

  const title =
    snap.displayName ||
    (looking ? `Looking up ${snap.barcode}…` : item.lookup === 'not_found' ? 'Unknown product' : 'Untitled product');
  const subtitle = [snap.packSize, snap.barcode].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${title}`}
    >
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, !snap.displayName && styles.rowTitleMuted]} numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        <View style={styles.badges}>
          {looking ? (
            <ActivityIndicator size="small" color={T.accent} />
          ) : missingPrice ? (
            <View style={[styles.badge, styles.badgeWarn]}>
              <Ionicons name="alert-circle" size={13} color={T.error} />
              <Text style={[styles.badgeText, styles.badgeWarnText]}>Needs price</Text>
            </View>
          ) : (
            price.kind === 'ok' && (
              <Text style={styles.price}>£{formatMinor(price.minor)}</Text>
            )
          )}
          {item.lookup === 'not_found' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Not in catalogue</Text>
            </View>
          )}
          {item.lookup === 'error' && (
            <View style={[styles.badge, styles.badgeWarn]}>
              <Text style={[styles.badgeText, styles.badgeWarnText]}>Lookup failed</Text>
            </View>
          )}
          {!looking && otherErrors && !missingPrice && (
            <View style={[styles.badge, styles.badgeWarn]}>
              <Text style={[styles.badgeText, styles.badgeWarnText]}>Check details</Text>
            </View>
          )}
        </View>
      </View>

      {!onCopies ? (
        <Pressable onPress={onRemove} hitSlop={6} style={styles.stepButton} accessibilityLabel="Remove">
          <Ionicons name="trash-outline" size={16} color={T.text} />
        </Pressable>
      ) : (
      <View style={styles.stepper}>
        <Pressable
          onPress={() => (item.copies <= 1 ? onRemove() : onCopies(item.copies - 1))}
          hitSlop={6}
          style={styles.stepButton}
          accessibilityLabel={item.copies <= 1 ? 'Remove' : 'Fewer copies'}
        >
          <Ionicons name={item.copies <= 1 ? 'trash-outline' : 'remove'} size={16} color={T.text} />
        </Pressable>
        <Text style={styles.copies}>{item.copies}</Text>
        <Pressable
          onPress={() => onCopies(item.copies + 1)}
          hitSlop={6}
          style={styles.stepButton}
          accessibilityLabel="More copies"
        >
          <Ionicons name="add" size={16} color={T.text} />
        </Pressable>
      </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heading: {
    fontSize: 18.5,
    fontWeight: '500',
    color: T.text,
  },
  count: {
    fontSize: 16.5,
    fontWeight: '400',
    color: T.textSecondary,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 36,
  },
  illustration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18.5,
    fontWeight: '500',
    color: T.text,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 10,
    fontSize: 14.5,
    lineHeight: 22,
    color: T.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 22,
  },
  emptyButtons: {
    alignSelf: 'stretch',
    marginTop: 34,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
  },
  rowPressed: {
    backgroundColor: T.pressed,
  },
  rowMain: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: T.text,
  },
  rowTitleMuted: {
    color: T.textSecondary,
  },
  rowSubtitle: {
    fontSize: 13,
    color: T.textSecondary,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: T.text,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: T.bg,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.textSecondary,
  },
  badgeWarn: {
    backgroundColor: T.errorSoft,
  },
  badgeWarnText: {
    color: T.error,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copies: {
    minWidth: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: T.text,
  },
});
