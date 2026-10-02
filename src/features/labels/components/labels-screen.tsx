import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LabelTokens as T } from '../tokens';

/**
 * Labels-module header: white bar, black back chevron, LEFT-aligned title,
 * optional right accessory (ellipsis / Show all). Matches R04/R12/R16/R21.
 */
export function LabelsHeader({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={26} color={T.text} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

/** Horizontal-ellipsis header accessory (menu contents arrive in Batch 8). */
export function HeaderEllipsis({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable hitSlop={12} onPress={onPress} accessibilityRole="button" accessibilityLabel="More options">
      <Ionicons name="ellipsis-horizontal" size={22} color={T.text} />
    </Pressable>
  );
}

/** Full-screen scaffold: safe area + white header zone + light-grey body. */
export function LabelsScreen({
  title,
  right,
  children,
  headerBottom,
  onBack,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  headerBottom?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerZone}>
        <LabelsHeader title={title} right={right} onBack={onBack} />
        {headerBottom}
      </View>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: T.bg,
  },
  headerZone: {
    backgroundColor: T.bg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.insetPage,
    paddingVertical: 12,
    backgroundColor: T.bg,
    gap: 10,
  },
  backButton: {
    marginLeft: -4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: T.text,
  },
  right: {
    minWidth: 26,
    alignItems: 'flex-end',
  },
  body: {
    flex: 1,
    backgroundColor: T.bg,
  },
});
