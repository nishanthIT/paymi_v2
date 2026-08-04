import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

interface AddNewProductSheetProps {
  visible: boolean;
  barcode: string;
  onClose: () => void;
  onSubmit: (input: { title: string; retailSize: string }) => void;
  submitting?: boolean;
}

/**
 * Shown instead of an error when a scanned barcode has no matching product.
 * Submits to the existing quick-add endpoint — the product then appears in
 * Admin → New Products for review/approval.
 */
export function AddNewProductSheet({
  visible,
  barcode,
  onClose,
  onSubmit,
  submitting,
}: AddNewProductSheetProps) {
  const [title, setTitle] = useState('');
  const [retailSize, setRetailSize] = useState('');

  useEffect(() => {
    if (visible) {
      setTitle('');
      setRetailSize('');
    }
  }, [visible, barcode]);

  const canSubmit = title.trim().length > 1 && !submitting;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware>
      <View style={styles.headerIcon}>
        <Ionicons name="pricetag-outline" size={26} color={Colors.light.primary} />
      </View>
      <Text style={styles.title}>Add New Product</Text>
      <Text style={styles.subtitle}>
        This barcode isn’t in our catalogue yet. Add the basics below and our team will
        review and approve it.
      </Text>

      <Text style={styles.label}>Barcode</Text>
      <View style={styles.barcodeField}>
        <Ionicons name="barcode-outline" size={18} color={Colors.light.textSecondary} />
        <Text style={styles.barcodeText} numberOfLines={1}>
          {barcode}
        </Text>
        <View style={styles.readOnlyBadge}>
          <Text style={styles.readOnlyBadgeText}>Read-only</Text>
        </View>
      </View>

      <Text style={styles.label}>Product Name *</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Coca-Cola 330ml Can"
        placeholderTextColor={Colors.light.textLight}
        style={styles.input}
        autoFocus
        returnKeyType="next"
      />

      <Text style={styles.label}>Pack / Size (optional)</Text>
      <TextInput
        value={retailSize}
        onChangeText={setRetailSize}
        placeholder="e.g. 330ml, 6-pack"
        placeholderTextColor={Colors.light.textLight}
        style={styles.input}
        returnKeyType="done"
      />

      <View style={styles.actions}>
        <PrimaryButton
          title={submitting ? 'Submitting…' : 'Submit for Review'}
          onPress={() => onSubmit({ title: title.trim(), retailSize: retailSize.trim() })}
          disabled={!canSubmit}
          loading={submitting}
        />
        <PrimaryButton title="Cancel" variant="ghost" onPress={onClose} disabled={submitting} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  headerIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.h4,
    color: Colors.light.text,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  barcodeField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: Spacing.md,
  },
  barcodeText: {
    ...Typography.bodyBold,
    color: Colors.light.text,
    flex: 1,
  },
  readOnlyBadge: {
    backgroundColor: Colors.light.divider,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  readOnlyBadgeText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '700',
  },
  input: {
    ...Typography.body,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: Spacing.md,
  },
  actions: {
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
});
