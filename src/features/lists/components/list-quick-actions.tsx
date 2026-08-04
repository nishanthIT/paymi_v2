import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 18, stiffness: 300 };

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  variant: 'primary' | 'outline';
  onPress: () => void;
}

function QuickAction({ icon, title, variant, onPress }: QuickActionProps) {
  const scale = useSharedValue(1);
  const isPrimary = variant === 'primary';
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPressIn={() => scale.set(withSpring(0.94, SPRING))}
      onPressOut={() => scale.set(withSpring(1, SPRING))}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.action, isPrimary ? styles.actionPrimary : styles.actionOutline, Shadows.sm, animatedStyle]}
    >
      <Ionicons name={icon} size={16} color={isPrimary ? '#FFFFFF' : Colors.light.primary} />
      <Text style={[styles.label, isPrimary && styles.labelPrimary]} numberOfLines={1}>
        {title}
      </Text>
    </AnimatedPressable>
  );
}

interface ListQuickActionsProps {
  onScan: () => void;
  onAddProduct: () => void;
}

/** Compact two-pill action bar: scan a barcode or search/add a product manually. */
export function ListQuickActions({ onScan, onAddProduct }: ListQuickActionsProps) {
  return (
    <View style={styles.row}>
      <QuickAction icon="scan" title="Scan Barcode" variant="outline" onPress={onScan} />
      <QuickAction icon="add-circle" title="Add Product" variant="primary" onPress={onAddProduct} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: BorderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
  },
  actionPrimary: {
    backgroundColor: Colors.light.primary,
  },
  actionOutline: {
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  label: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
  },
  labelPrimary: {
    color: '#FFFFFF',
  },
});
