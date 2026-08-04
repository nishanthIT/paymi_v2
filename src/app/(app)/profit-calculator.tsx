import React, { useMemo, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { formatMoney, parseMoneyInput } from '@/features/shop-tools/format';

/** Profit calculator: cost + selling (+ optional VAT %) → profit, margin and markup. */
export default function ProfitCalculatorScreen() {
  const [costText, setCostText] = useState('');
  const [sellText, setSellText] = useState('');
  const [vatText, setVatText] = useState('0');

  const cost = parseMoneyInput(costText);
  const selling = parseMoneyInput(sellText);
  const vatRate = parseMoneyInput(vatText) ?? 0;

  const result = useMemo(() => {
    if (cost == null || cost <= 0 || selling == null || selling <= 0) return null;
    // VAT-registered sellers only keep the net portion of the selling price.
    const netSelling = vatRate > 0 ? selling / (1 + vatRate / 100) : selling;
    const vatAmount = selling - netSelling;
    const profit = netSelling - cost;
    const markupPct = (profit / cost) * 100; // profit relative to cost
    const marginPct = (profit / netSelling) * 100; // profit relative to net revenue
    return { netSelling, vatAmount, profit, markupPct, marginPct };
  }, [cost, selling, vatRate]);

  const isLoss = result != null && result.profit < 0;

  return (
    <ToolScreen title="Profit Calculator" subtitle="Live margin & markup" scroll>
      <View style={styles.card}>
        <MoneyField label="Cost price" value={costText} onChange={setCostText} />
        <MoneyField label="Selling price" value={sellText} onChange={setSellText} />
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>VAT rate on sale (%)</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={vatText}
              onChangeText={setVatText}
              placeholder="0"
              placeholderTextColor={Colors.light.textLight}
              keyboardType="decimal-pad"
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            <Text style={styles.suffix}>%</Text>
          </View>
        </View>
      </View>

      {result && (
        <View style={styles.resultCard}>
          {vatRate > 0 && (
            <>
              <Row label="Net selling price" value={formatMoney(result.netSelling)} />
              <Row label={`VAT collected @ ${vatRate}%`} value={formatMoney(result.vatAmount)} />
              <View style={styles.divider} />
            </>
          )}
          <Row
            label={isLoss ? 'Net loss' : 'Net profit'}
            value={formatMoney(Math.abs(result.profit))}
            color={isLoss ? Colors.light.error : Colors.light.success}
            big
          />
          <View style={styles.pctRow}>
            <PctCard label="Margin" value={result.marginPct} isLoss={isLoss} hint="profit ÷ revenue" />
            <PctCard label="Markup" value={result.markupPct} isLoss={isLoss} hint="profit ÷ cost" />
          </View>
          {isLoss && (
            <Text style={styles.lossNote}>
              You&apos;re selling below cost{vatRate > 0 ? ' after VAT' : ''} — increase the selling
              price to break even at {formatMoney(cost! * (1 + vatRate / 100))}.
            </Text>
          )}
        </View>
      )}
    </ToolScreen>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <Text style={styles.currency}>£</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="0.00"
          placeholderTextColor={Colors.light.textLight}
          keyboardType="decimal-pad"
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  color,
  big,
}: {
  label: string;
  value: string;
  color?: string;
  big?: boolean;
}) {
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, big && styles.resultLabelBig]}>{label}</Text>
      <Text style={[big ? styles.resultValueBig : styles.resultValue, color ? { color } : null]}>
        {value}
      </Text>
    </View>
  );
}

function PctCard({
  label,
  value,
  isLoss,
  hint,
}: {
  label: string;
  value: number;
  isLoss: boolean;
  hint: string;
}) {
  return (
    <View style={styles.pctCard}>
      <Text style={styles.pctLabel}>{label}</Text>
      <Text style={[styles.pctValue, { color: isLoss ? Colors.light.error : Colors.light.success }]}>
        {value.toFixed(1)}%
      </Text>
      <Text style={styles.pctHint}>{hint}</Text>
    </View>
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
  input: {
    ...Typography.h3,
    color: Colors.light.text,
    flex: 1,
    paddingVertical: 14,
  },
  suffix: {
    ...Typography.h4,
    color: Colors.light.textSecondary,
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
  resultLabelBig: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  resultValue: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  resultValueBig: {
    ...Typography.price,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.divider,
    marginVertical: 2,
  },
  pctRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  pctCard: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  pctLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pctValue: {
    ...Typography.h3,
  },
  pctHint: {
    ...Typography.caption,
    color: Colors.light.textLight,
  },
  lossNote: {
    ...Typography.bodySmall,
    color: Colors.light.error,
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
});
