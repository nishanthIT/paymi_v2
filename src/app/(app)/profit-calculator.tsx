import React, { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { SegmentedTabs } from '@/features/shop-tools/components/segmented-tabs';
import { ToolScreen } from '@/features/shop-tools/components/tool-screen';
import { formatMoney } from '@/features/shop-tools/format';
import { calculateProfit, parseCalculatorDecimal, stepCalculatorPercent, type PriceMode, type ProfitBasis } from '@/features/shop-tools/profit-calculator';

type CalcMode = 'single' | 'case' | 'bulk';

export default function ProfitCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<CalcMode>('single');
  const [priceMode, setPriceMode] = useState<PriceMode>('selling');
  const [profitBasis, setProfitBasis] = useState<ProfitBasis>('margin');
  const [costText, setCostText] = useState('');
  const [sellText, setSellText] = useState('');
  const [vatText, setVatText] = useState('0');
  const [profitText, setProfitText] = useState('30');
  const [quantityText, setQuantityText] = useState('');
  const [purchaseText, setPurchaseText] = useState('');
  const purchaseCost = parseCalculatorDecimal(mode === 'single' ? costText : purchaseText);
  const units = mode === 'single' ? 1 : parseCalculatorDecimal(quantityText);
  const vatPercent = parseCalculatorDecimal(vatText);
  const targetPercent = parseCalculatorDecimal(profitText);
  const sellingPrice = parseCalculatorDecimal(sellText);
  const hasPurchase = (mode === 'single' ? costText : purchaseText) !== '';
  const result = calculateProfit({
    purchaseCost: purchaseCost ?? NaN,
    units: units ?? NaN,
    vatPercent: vatPercent ?? NaN,
    priceMode,
    sellingPrice: sellingPrice ?? undefined,
    targetPercent: targetPercent ?? undefined,
    profitBasis,
  });
  const valid = result.error === null;
  const isLoss = valid && result.profit < 0;
  const resultColor = isLoss ? Colors.light.error : Colors.light.success;

  function changePriceMode(next: PriceMode) {
    // Moving to manual prices starts from the currently calculated, rounded price.
    if (next === 'selling' && valid) setSellText(result.sellingPrice.toFixed(2));
    setPriceMode(next);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ToolScreen title="Profit Calculator" subtitle="Prices, VAT & profit">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="never"
        >
          <SegmentedTabs<CalcMode> options={[{ value: 'single', label: 'Product' }, { value: 'case', label: 'Case' }, { value: 'bulk', label: 'Bulk' }]} value={mode} onChange={setMode} />
          <View style={styles.card}>
            <View style={styles.fieldsRow}>
              <View style={styles.rowField}><DecimalField label={mode === 'single' ? 'Purchase cost (£)' : `Total ${mode} cost (£)`} value={mode === 'single' ? costText : purchaseText} onChange={mode === 'single' ? setCostText : setPurchaseText} /></View>
              {mode !== 'single' && <View style={styles.rowField}><DecimalField label={mode === 'case' ? 'Units in case' : 'Total units'} value={quantityText} onChange={setQuantityText} integer /></View>}
            </View>
            <Text style={styles.hint}>Use the cost your business bears, excluding recoverable VAT. Sale prices include VAT.</Text>
            <PercentField label="VAT on sale" value={vatText} onChange={setVatText} max={100} />
            <ChoiceRow<PriceMode> label="Calculate from" options={[{ value: 'selling', label: 'Selling price' }, { value: 'target', label: 'Target profit' }]} value={priceMode} onChange={changePriceMode} />
            {priceMode === 'selling' ? (
              <DecimalField label="Selling price per unit (£)" value={sellText} onChange={setSellText} />
            ) : (
              <>
                <ChoiceRow<ProfitBasis> label="Profit percentage" options={[{ value: 'margin', label: 'Margin' }, { value: 'markup', label: 'Markup' }]} value={profitBasis} onChange={setProfitBasis} />
                <PercentField label={profitBasis === 'margin' ? 'Target margin' : 'Target markup'} value={profitText} onChange={setProfitText} max={profitBasis === 'margin' ? 99.99 : 1_000_000} />
                <Text style={styles.hint}>{profitBasis === 'margin' ? 'Margin = profit ÷ sale revenue excluding VAT.' : 'Markup = profit ÷ purchase cost.'} Target prices round up to the next penny.</Text>
              </>
            )}
            {hasPurchase && !valid && <Text accessibilityRole="alert" style={styles.error}>{result.error}</Text>}
          </View>
          {valid && (
            <View style={styles.card}>
              <View style={styles.tableRow}>
                <Text style={[styles.tableLabel, styles.tableHeading]}>Breakdown</Text>
                <Text style={[styles.tableValue, styles.tableHeading]}>Per unit</Text>
                {mode !== 'single' && <Text style={[styles.tableValue, styles.tableHeading]}>{result.units} units</Text>}
              </View>
              <AmountRow label="Cost" unit={result.unitCost} total={mode !== 'single' ? result.totalCost : undefined} />
              <AmountRow label="Sale incl. VAT" unit={result.sellingPrice} total={mode !== 'single' ? result.totalSales : undefined} />
              <AmountRow label="VAT" unit={result.vatAmount} total={mode !== 'single' ? result.totalVat : undefined} />
              <AmountRow label={isLoss ? 'Loss' : 'Profit'} unit={Math.abs(result.profit)} total={mode !== 'single' ? Math.abs(result.totalProfit) : undefined} color={resultColor} />
              <View style={styles.divider} />
              <Text style={styles.hint}>Actual margin {percent(result.marginPercent)} · Markup {percent(result.markupPercent)}</Text>
              <Text style={styles.hint}>Totals use unrounded unit costs and VAT; displayed amounts are rounded to pennies.</Text>
              {isLoss && <Text style={styles.error}>Selling below cost after VAT. Break-even price: {formatMoney(result.breakEvenPrice)} per unit.</Text>}
            </View>
          )}
        </ScrollView>
        <View style={[styles.summary, { paddingBottom: Math.max(Spacing.sm, insets.bottom) }]}>
          <View style={styles.summaryValues}>
            <View style={styles.summaryMetric}>
              <Text style={styles.hint}>Sale / unit</Text>
              <Text style={styles.summaryPrice}>{valid ? formatMoney(result.sellingPrice) : '—'}</Text>
            </View>
            <View style={styles.summaryMetric}>
              <Text style={styles.hint}>{mode === 'single' ? 'Profit / unit' : 'Total profit'}</Text>
              <Text style={[styles.summaryPrice, { color: resultColor }]}>{valid ? formatMoney(result.totalProfit) : '—'}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Hide keyboard" onPress={Keyboard.dismiss} style={styles.doneButton}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </ToolScreen>
    </KeyboardAvoidingView>
  );
}

function percent(value: number | null) {
  if (value === null) return '—';
  if (value < 100 && value > 99.99) return '<100%';
  return `${Number(value.toFixed(2))}%`;
}

function DecimalField({ label, value, onChange, integer = false }: { label: string; value: string; onChange: (value: string) => void; integer?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={(text) => {
        if ((integer ? /^\d*$/ : /^\d*(?:\.\d{0,2})?$/).test(text)) onChange(text);
      }} placeholder={integer ? '0' : '0.00'} placeholderTextColor={Colors.light.textLight} keyboardType={integer ? 'number-pad' : 'decimal-pad'} style={styles.input} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
    </View>
  );
}

function PercentField({ label, value, onChange, max }: { label: string; value: string; onChange: (value: string) => void; max: number }) {
  const parsed = parseCalculatorDecimal(value);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label} (%)</Text>
      <View style={styles.stepper}>
        <StepButton label={`Decrease ${label} by 1 percentage point`} text="−" disabled={parsed === 0} onPress={() => onChange(stepCalculatorPercent(parsed, -1, max))} />
        <TextInput accessibilityLabel={`${label} percentage`} value={value} onChangeText={(text) => { if (/^\d*(?:\.\d{0,2})?$/.test(text)) onChange(text); }} keyboardType="decimal-pad" style={[styles.input, styles.percentInput]} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
        <StepButton label={`Increase ${label} by 1 percentage point`} text="+" disabled={parsed !== null && parsed >= max} onPress={() => onChange(stepCalculatorPercent(parsed, 1, max))} />
      </View>
    </View>
  );
}

function StepButton({ label, text, disabled, onPress }: { label: string; text: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.stepButton, disabled && styles.disabled]}><Text style={styles.stepText}>{text}</Text></Pressable>;
}

function ChoiceRow<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.fieldsRow}>{options.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: option.value === value }} onPress={() => onChange(option.value)} style={[styles.choice, option.value === value && styles.choiceSelected]}><Text style={[styles.choiceText, option.value === value && styles.choiceTextSelected]}>{option.label}</Text></Pressable>)}</View></View>;
}

function AmountRow({ label, unit, total, color }: { label: string; unit: number; total?: number; color?: string }) {
  return <View style={styles.tableRow}><Text style={styles.tableLabel}>{label}</Text><Text style={[styles.tableValue, color ? { color } : null]}>{formatMoney(unit)}</Text>{total !== undefined && <Text style={[styles.tableValue, color ? { color } : null]}>{formatMoney(total)}</Text>}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.sm },
  card: { backgroundColor: Colors.light.backgroundCard, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.light.border, padding: Spacing.md, gap: Spacing.sm, ...Shadows.sm },
  fieldsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  field: { gap: 5 },
  rowField: { flex: 1, minWidth: 120 },
  label: { ...Typography.caption, fontWeight: '600', color: Colors.light.textSecondary },
  hint: { ...Typography.caption, color: Colors.light.textSecondary, flexShrink: 1 },
  input: { ...Typography.body, minHeight: 44, paddingHorizontal: Spacing.sm, paddingVertical: 8, borderWidth: 1, borderColor: Colors.light.border, borderRadius: BorderRadius.md, backgroundColor: Colors.light.backgroundSecondary, color: Colors.light.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  percentInput: { flex: 1, textAlign: 'center' },
  stepButton: { minWidth: 44, minHeight: 44, borderRadius: BorderRadius.md, backgroundColor: Colors.light.backgroundSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.light.border },
  stepText: { ...Typography.h3, color: Colors.light.primary },
  disabled: { opacity: 0.4 },
  choice: { flex: 1, minWidth: 110, minHeight: 44, justifyContent: 'center', alignItems: 'center', padding: 8, borderRadius: BorderRadius.md, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.border },
  choiceSelected: { backgroundColor: Colors.light.primary },
  choiceText: { ...Typography.bodySmall, color: Colors.light.text },
  choiceTextSelected: { color: '#fff', fontWeight: '700' },
  error: { ...Typography.bodySmall, color: Colors.light.error },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  tableLabel: { ...Typography.caption, flex: 1, color: Colors.light.textSecondary },
  tableValue: { ...Typography.bodySmall, fontWeight: '600', flex: 1, textAlign: 'right', color: Colors.light.text },
  tableHeading: { fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.light.border },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.light.border, backgroundColor: Colors.light.backgroundCard },
  summaryValues: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  summaryMetric: { flex: 1, minWidth: 95 },
  summaryPrice: { ...Typography.h4, color: Colors.light.text },
  doneButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.light.primary },
  doneText: { ...Typography.bodySmall, color: '#fff', fontWeight: '600' },
});
