import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

import { searchCatalogue } from '../catalogue';
import { looksLikeBarcode } from '../model/barcode';
import type { CatalogueLookupResult } from '../model/label-item';
import { catalogueRrpToMinor, formatMinor } from '../model/money';
import { LabelTokens as T } from '../tokens';

/**
 * Product-search sheet (R04): focused rounded search input with barcode icon,
 * then "Add custom product". Results rows are an inferred extension (unseen).
 */
export function ProductSearchSheet({
  visible,
  onClose,
  onPick,
  onBarcode,
  onScan,
  onAddCustom,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (result: CatalogueLookupResult) => void;
  /** A typed barcode goes through the same lookup path as a scan. */
  onBarcode: (barcode: string) => void;
  onScan: () => void;
  onAddCustom: () => void;
}) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const query = useDebouncedValue(text.trim(), 300);
  const typedBarcode = looksLikeBarcode(text) ? text.trim() : null;

  const results = useQuery({
    queryKey: ['labels', 'search', query.toLowerCase()],
    queryFn: () => searchCatalogue(query),
    enabled: visible && query.length >= 2 && !looksLikeBarcode(query),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const close = () => {
    setText('');
    onClose();
  };

  const showResults = text.trim().length >= 2 && !typedBarcode;

  return (
    <BottomSheet visible={visible} onClose={close} keyboardAware scrollable sheetStyle={styles.sheet}>
      <View style={styles.content}>
        <View style={[styles.searchBox, focused && styles.searchBoxFocused]}>
          <Ionicons name="search" size={20} color={T.textSecondary} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search products..."
            placeholderTextColor={T.textLight}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => {
              if (typedBarcode) {
                onBarcode(typedBarcode);
                close();
              }
            }}
            style={styles.searchInput}
          />
          <Pressable onPress={onScan} hitSlop={10} accessibilityRole="button" accessibilityLabel="Scan barcode">
            <MaterialCommunityIcons name="barcode-scan" size={22} color={T.text} />
          </Pressable>
        </View>

        {typedBarcode && (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              onBarcode(typedBarcode);
              close();
            }}
          >
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons name="barcode" size={20} color={T.accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Look up {typedBarcode}</Text>
              <Text style={styles.rowSubtitle}>Find this barcode in the catalogue</Text>
            </View>
          </Pressable>
        )}

        {showResults && (
          <View style={styles.results}>
            {results.isFetching && !results.data && (
              <ActivityIndicator color={T.accent} style={styles.loader} />
            )}
            {results.isError && (
              <Text style={styles.stateText}>{"Search isn't available right now — try again."}</Text>
            )}
            {results.data?.length === 0 && !results.isFetching && (
              <Text style={styles.stateText}>{`No products match "${text.trim()}".`}</Text>
            )}
            {results.data?.map((result) => {
              const rrp = catalogueRrpToMinor(result.rrp);
              return (
                <Pressable
                  key={result.id}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.rowPressed]}
                  onPress={() => {
                    onPick(result);
                    close();
                  }}
                >
                  <View style={styles.thumb}>
                    {result.imageUri ? (
                      <Image source={{ uri: result.imageUri }} style={styles.thumbImage} contentFit="contain" />
                    ) : (
                      <Ionicons name="cube-outline" size={18} color={T.textLight} />
                    )}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.resultTitle} numberOfLines={2}>
                      {result.title}
                    </Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {[result.retailSize, result.barcode].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={[styles.rrp, rrp == null && styles.rrpMissing]}>
                    {rrp != null ? `RRP £${formatMinor(rrp)}` : 'No RRP'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => {
            onAddCustom();
            close();
          }}
          accessibilityRole="button"
        >
          <View style={styles.rowIcon}>
            <Ionicons name="add" size={22} color={T.accent} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Add custom product</Text>
            <Text style={styles.rowSubtitle}>Enter name, brand, price, and upload your own photo</Text>
          </View>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: T.bg,
  },
  content: {
    gap: 6,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.labelOutline,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  searchBoxFocused: {
    borderColor: T.accent,
    borderWidth: 2,
    paddingHorizontal: 13,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: T.text,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
  },
  rowPressed: {
    backgroundColor: T.bg,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: T.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: T.text,
  },
  rowSubtitle: {
    fontSize: T.fontBody,
    color: T.textSecondary,
  },
  results: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: T.divider,
    paddingVertical: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 2,
    borderRadius: 10,
  },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: T.thumbTile,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: T.text,
  },
  rrp: {
    fontSize: 13,
    fontWeight: '700',
    color: T.text,
  },
  rrpMissing: {
    color: T.textLight,
    fontWeight: '500',
  },
  loader: {
    paddingVertical: 12,
  },
  stateText: {
    fontSize: T.fontBody,
    color: T.textSecondary,
    paddingVertical: 12,
    textAlign: 'center',
  },
});
