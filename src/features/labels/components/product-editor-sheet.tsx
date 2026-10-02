import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';

import {
  priceSource,
  setPriceText,
  setRrpText,
  validateItem,
  type ItemErrors,
  type LabelItem,
} from '../model/label-item';
import { formatMinor } from '../model/money';
import { LabelTokens as T } from '../tokens';
import { LabelField } from './label-field';

type Touched = Partial<Record<keyof ItemErrors, boolean>>;

function priceHelper(item: LabelItem): string {
  const rrp = item.snapshot.sourceRrpMinor;
  switch (priceSource(item)) {
    case 'catalogue_rrp':
      return `Filled from the catalogue RRP (£${formatMinor(rrp!)}). Change it to set your own price.`;
    case 'owner_rrp':
      return 'Filled from the RRP you entered. Change it to set your own price.';
    case 'owner':
      return rrp != null
        ? `Your price — this prints on the label. Catalogue RRP is £${formatMinor(rrp)}.`
        : 'Your price — this prints on the label.';
    default:
      if (item.lookup === 'looking_up') return 'Waiting for the catalogue…';
      return item.lookup === 'found'
        ? 'No RRP in the catalogue for this product — enter the price you want to charge.'
        : 'Enter the price you want to charge.';
  }
}

/**
 * Product editor (inferred screen — full editor not in the references).
 * Edits the label's own snapshot only; the global catalogue is never changed.
 */
export function ProductEditorSheet({
  item,
  visible,
  onUpdate,
  onRetryLookup,
  onClose,
  onRemove,
}: {
  item: LabelItem | null;
  visible: boolean;
  onUpdate: (update: (item: LabelItem) => LabelItem) => void;
  onRetryLookup: () => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [touched, setTouched] = useState<Touched>({});
  const [lastItemId, setLastItemId] = useState<string | null>(null);
  if ((item?.id ?? null) !== lastItemId) {
    setLastItemId(item?.id ?? null);
    setTouched({});
  }

  if (!item) return null;

  const errors = validateItem(item);
  const touch = (field: keyof ItemErrors) => setTouched((prev) => ({ ...prev, [field]: true }));
  const shown = (field: keyof ItemErrors) => (touched[field] ? errors[field] : undefined);
  const snap = item.snapshot;
  const setSnap = (patch: Partial<LabelItem['snapshot']>) =>
    onUpdate((current) => ({ ...current, snapshot: { ...current.snapshot, ...patch } }));

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (uri) setSnap({ imageUri: uri });
    } catch {
      Alert.alert('Photos unavailable', 'Could not open your photo library.');
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware scrollable sheetStyle={styles.sheet}>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {item.snapshot.catalogueProductId ? 'Product details' : 'Custom product'}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={styles.doneLink}>Done</Text>
          </Pressable>
        </View>

        {item.lookup === 'looking_up' && (
          <View style={styles.status}>
            <ActivityIndicator size="small" color={T.accent} />
            <Text style={styles.statusText}>Looking up {snap.barcode}…</Text>
          </View>
        )}
        {item.lookup === 'not_found' && (
          <View style={styles.status}>
            <Ionicons name="help-circle-outline" size={18} color={T.textSecondary} />
            <Text style={styles.statusText}>
              {`${snap.barcode} isn't in the catalogue — add the details yourself.`}
            </Text>
          </View>
        )}
        {item.lookup === 'error' && (
          <Pressable style={[styles.status, styles.statusError]} onPress={onRetryLookup}>
            <Ionicons name="refresh" size={18} color={T.error} />
            <Text style={[styles.statusText, { color: T.error }]}>
              {item.lookupError ?? 'Lookup failed'} — tap to retry
            </Text>
          </Pressable>
        )}

        <View style={styles.photoRow}>
          <View style={styles.photo}>
            {snap.imageUri ? (
              <Image source={{ uri: snap.imageUri }} style={styles.photoImage} contentFit="contain" />
            ) : (
              <Ionicons name="image-outline" size={22} color={T.textLight} />
            )}
          </View>
          <View style={styles.photoActions}>
            <Pressable onPress={pickPhoto} hitSlop={6}>
              <Text style={styles.link}>{snap.imageUri ? 'Change photo' : 'Upload photo'}</Text>
            </Pressable>
            {snap.imageUri ? (
              <Pressable onPress={() => setSnap({ imageUri: undefined })} hitSlop={6}>
                <Text style={styles.linkMuted}>Remove photo</Text>
              </Pressable>
            ) : (
              <Text style={styles.photoHint}>Optional — text labels print without one</Text>
            )}
          </View>
        </View>

        <LabelField
          label="Name"
          value={snap.displayName}
          onChangeText={(displayName) => setSnap({ displayName })}
          onBlur={() => touch('displayName')}
          error={shown('displayName')}
          placeholder="e.g. Mud House Sauvignon Blanc"
        />
        <View style={styles.pair}>
          <View style={styles.flex}>
            <LabelField
              label="Brand"
              value={snap.brand}
              onChangeText={(brand) => setSnap({ brand })}
              helper="Optional"
            />
          </View>
          <View style={styles.flex}>
            <LabelField
              label="Pack size"
              value={snap.packSize}
              onChangeText={(packSize) => setSnap({ packSize })}
              placeholder="e.g. 75cl"
            />
          </View>
        </View>

        <LabelField
          label="Barcode"
          value={snap.barcode}
          onChangeText={(barcode) => setSnap({ barcode: barcode.trim(), barcodeSymbology: undefined })}
          onBlur={() => touch('barcode')}
          error={shown('barcode')}
          keyboardType={snap.customCode ? 'default' : 'number-pad'}
          autoCapitalize="characters"
          helper="Optional · EAN-13, UPC-A, EAN-8 or your own code"
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>This is my own code, not a retail barcode</Text>
          <Switch
            value={!!snap.customCode}
            onValueChange={(customCode) => setSnap({ customCode })}
            trackColor={{ true: T.accent }}
          />
        </View>

        <View style={styles.pair}>
          <View style={styles.flex}>
            <LabelField
              label="Price"
              value={item.priceText}
              onChangeText={(text) => onUpdate((current) => setPriceText(current, text))}
              onBlur={() => touch('price')}
              error={shown('price')}
              keyboardType="decimal-pad"
              placeholder="0.00"
              right={<Text style={styles.currency}>£</Text>}
            />
          </View>
          <View style={styles.flex}>
            <LabelField
              label="RRP"
              value={item.rrpText}
              onChangeText={(text) => onUpdate((current) => setRrpText(current, text))}
              onBlur={() => touch('rrp')}
              error={shown('rrp')}
              keyboardType="decimal-pad"
              placeholder="Optional"
              right={<Text style={styles.currency}>£</Text>}
            />
          </View>
        </View>
        <Text style={[styles.note, !item.priceText.trim() && item.lookup !== 'looking_up' && styles.noteWarn]}>
          {priceHelper(item)}
        </Text>

        <LabelField
          label="Was price"
          value={item.wasText}
          onChangeText={(wasText) => onUpdate((current) => ({ ...current, wasText }))}
          onBlur={() => touch('was')}
          error={shown('was')}
          keyboardType="decimal-pad"
          placeholder="Optional"
          helper="Optional · the price you charged before — not the RRP"
        />

        <Text style={styles.section}>Multi-buy offer</Text>
        <View style={styles.pair}>
          <View style={styles.flex}>
            <LabelField
              label="Quantity"
              value={item.offerQuantityText}
              onChangeText={(text) =>
                onUpdate((current) => ({ ...current, offerQuantityText: text.replace(/\D/g, '') }))
              }
              onBlur={() => touch('offer')}
              keyboardType="number-pad"
              placeholder="e.g. 2"
            />
          </View>
          <View style={styles.flex}>
            <LabelField
              label="Offer total"
              value={item.offerTotalText}
              onChangeText={(offerTotalText) => onUpdate((current) => ({ ...current, offerTotalText }))}
              onBlur={() => touch('offer')}
              keyboardType="decimal-pad"
              placeholder="e.g. 16.00"
              right={<Text style={styles.currency}>£</Text>}
            />
          </View>
        </View>
        {shown('offer') ? (
          <Text style={[styles.note, styles.noteWarn]}>{errors.offer}</Text>
        ) : (
          <Text style={styles.note}>Optional · e.g. 2 for £16. Kept separate from the single price.</Text>
        )}

        <View style={styles.copiesRow}>
          <Text style={styles.copiesLabel}>Copies</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => onUpdate((current) => ({ ...current, copies: Math.max(1, current.copies - 1) }))}
              style={styles.stepButton}
              hitSlop={6}
              accessibilityLabel="Fewer copies"
            >
              <Ionicons name="remove" size={18} color={T.text} />
            </Pressable>
            <Text style={styles.copiesValue}>{item.copies}</Text>
            <Pressable
              onPress={() => onUpdate((current) => ({ ...current, copies: Math.min(999, current.copies + 1) }))}
              style={styles.stepButton}
              hitSlop={6}
              accessibilityLabel="More copies"
            >
              <Ionicons name="add" size={18} color={T.text} />
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={() => {
            setTouched({ displayName: true, barcode: true, price: true, rrp: true, was: true, offer: true });
            onClose();
          }}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Apply</Text>
        </Pressable>
        <Pressable onPress={onRemove} style={styles.removeButton} accessibilityRole="button">
          <Text style={styles.removeText}>Remove from labels</Text>
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
    gap: 14,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: T.text,
  },
  doneLink: {
    fontSize: 16,
    fontWeight: '600',
    color: T.accent,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: T.bg,
  },
  statusError: {
    backgroundColor: T.errorSoft,
  },
  statusText: {
    flex: 1,
    fontSize: T.fontBody,
    color: T.textSecondary,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: T.thumbTile,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoActions: {
    flex: 1,
    gap: 4,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: T.accent,
  },
  linkMuted: {
    fontSize: 14,
    color: T.textSecondary,
  },
  photoHint: {
    fontSize: T.fontDetail,
    color: T.textSecondary,
  },
  pair: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: -4,
  },
  switchLabel: {
    flex: 1,
    fontSize: T.fontBody,
    color: T.textSecondary,
  },
  currency: {
    fontSize: 16,
    color: T.textSecondary,
    marginLeft: 6,
  },
  note: {
    fontSize: T.fontDetail,
    lineHeight: 17,
    color: T.textSecondary,
    marginTop: -6,
    paddingHorizontal: 4,
  },
  noteWarn: {
    color: T.error,
  },
  section: {
    fontSize: T.fontCardTitle,
    fontWeight: '700',
    color: T.text,
    marginTop: 4,
  },
  copiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copiesLabel: {
    fontSize: T.fontCardTitle,
    fontWeight: '600',
    color: T.text,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copiesValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: T.text,
  },
  primary: {
    minHeight: 54,
    borderRadius: T.radiusButton,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  removeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  removeText: {
    fontSize: 15,
    fontWeight: '600',
    color: T.error,
  },
});
