import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { OptionPicker } from '@/features/shop-tools/components/option-picker';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { formatMoney, formatMoneyTyping, parseMoneyInput } from '@/features/shop-tools/format';

const STORAGE_KEY = 'shop-tools.vat-calculator.v1';
const QUICK_RATES = [5, 12.5, 20];

type VatMode = 'exclusive' | 'inclusive';

/** VAT calculator: add VAT to a net price or extract VAT from a gross price. */
export default function VatCalculatorScreen() {
  const { showToast } = useToast();
  const [amountText, setAmountText] = useState('');
  const [rateText, setRateText] = useState('20');
  const [mode, setMode] = useState<VatMode>('exclusive');

  // Restore last calculation.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (saved.amountText) setAmountText(saved.amountText);
        if (saved.rateText) setRateText(saved.rateText);
        if (saved.mode) setMode(saved.mode);
      } catch {
        // ignore corrupt saved state
      }
    });
  }, []);

  const amount = parseMoneyInput(amountText);
  const rate = parseMoneyInput(rateText);

  const result = useMemo(() => {
    if (amount == null || amount <= 0 || rate == null || rate < 0) return null;
    if (mode === 'exclusive') {
      const vat = amount * (rate / 100);
      return { net: amount, vat, gross: amount + vat };
    }
    const net = amount / (1 + rate / 100);
    return { net, vat: amount - net, gross: amount };
  }, [amount, rate, mode]);

  // Persist last calculation whenever it changes.
  useEffect(() => {
    if (result) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ amountText, rateText, mode })).catch(
        () => {},
      );
    }
  }, [amountText, rateText, mode, result]);

  const summaryText = result
    ? `Net: ${formatMoney(result.net)}\nVAT (${rate}%): ${formatMoney(result.vat)}\nGross: ${formatMoney(result.gross)}`
    : '';

  const handleCopy = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(summaryText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Result copied', 'success');
  };

  const handleShare = async () => {
    if (!result) return;
    try {
      await Share.share({ message: `VAT calculation\n${summaryText}` });
    } catch {
      // user dismissed share sheet
    }
  };

  return (
    <ToolScreen title="VAT Calculator" subtitle="Inclusive ↔ exclusive" scroll>
      <View style={styles.card}>
        <OptionPicker<VatMode>
          options={[
            { value: 'exclusive', label: 'Add VAT (net → gross)' },
            { value: 'inclusive', label: 'Remove VAT (gross → net)' },
          ]}
          value={mode}
          onChange={setMode}
        />

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            {mode === 'exclusive' ? 'Price excluding VAT' : 'Price including VAT'}
          </Text>
          <View style={styles.inputRow}>
            <Text style={styles.currency}>£</Text>
            <TextInput
              value={amountText}
              onChangeText={(text) => setAmountText(formatMoneyTyping(text))}
              placeholder="0.00"
              placeholderTextColor={Colors.light.textLight}
              keyboardType="decimal-pad"
              style={styles.amountInput}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>VAT rate</Text>
          <View style={styles.rateRow}>
            {QUICK_RATES.map((quick) => (
              <Pressable
                key={quick}
                onPress={() => {
                  Haptics.selectionAsync();
                  setRateText(String(quick));
                }}
                style={[styles.rateChip, rate === quick && styles.rateChipSelected]}
              >
                <Text style={[styles.rateChipText, rate === quick && styles.rateChipTextSelected]}>
                  {quick}%
                </Text>
              </Pressable>
            ))}
            <View style={styles.customRate}>
              <TextInput
                value={rateText}
                onChangeText={setRateText}
                keyboardType="decimal-pad"
                style={styles.customRateInput}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <Text style={styles.customRateSuffix}>%</Text>
            </View>
          </View>
        </View>
      </View>

      {result && (
        <View style={styles.resultCard}>
          <ResultRow label="Net amount" value={formatMoney(result.net)} />
          <ResultRow label={`VAT @ ${rate}%`} value={formatMoney(result.vat)} highlight />
          <View style={styles.divider} />
          <ResultRow label="Gross total" value={formatMoney(result.gross)} bold />

          <View style={styles.actionsRow}>
            <ActionButton icon="copy-outline" label="Copy" onPress={handleCopy} />
            <ActionButton icon="share-outline" label="Share" onPress={handleShare} />
          </View>
        </View>
      )}
    </ToolScreen>
  );
}

function ResultRow({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, bold && styles.resultLabelBold]}>{label}</Text>
      <Text
        style={[
          styles.resultValue,
          bold && styles.resultValueBold,
          highlight && { color: Colors.light.primary },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
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
      style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
    >
      <Ionicons name={icon} size={17} color={Colors.light.primary} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.lg,
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    ...Shadows.sm,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.light.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
  },
  currency: {
    ...Typography.h3,
    color: Colors.light.textSecondary,
    marginRight: Spacing.xs,
  },
  amountInput: {
    ...Typography.h3,
    color: Colors.light.text,
    flex: 1,
    paddingVertical: 14,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rateChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundCard,
  },
  rateChipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  rateChipText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  rateChipTextSelected: {
    color: '#FFFFFF',
  },
  customRate: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.light.backgroundSecondary,
    minWidth: 72,
  },
  customRateInput: {
    ...Typography.body,
    color: Colors.light.text,
    paddingVertical: 8,
    flex: 1,
    textAlign: 'right',
  },
  customRateSuffix: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    marginLeft: 2,
  },
  resultCard: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  resultLabelBold: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  resultValue: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  resultValueBold: {
    ...Typography.price,
    color: Colors.light.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.divider,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionLabel: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.primary,
  },
});
