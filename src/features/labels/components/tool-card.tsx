import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { LabelTokens as T } from '../tokens';

/** White rounded list card with thumbnail-left / text / chevron-right (R04/R12 rows). */
export function ToolCard({
  title,
  description,
  thumbnail,
  onPress,
}: {
  title: string;
  description: string;
  thumbnail: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.thumbTile}>{thumbnail}</View>
      <View style={styles.textArea}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={T.textLight} />
    </Pressable>
  );
}

/** Pale-grey thumbnail tile that hosts miniature label artwork at a fixed aspect. */
export function ThumbSurface({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.thumbSurface, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
    gap: 12,
  },
  cardPressed: {
    backgroundColor: T.pressed,
  },
  thumbTile: {
    width: 104,
    height: 84,
    borderRadius: T.radiusThumb,
    backgroundColor: T.thumbTile,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textArea: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: T.fontCardTitle + 1,
    fontWeight: '700',
    color: T.text,
  },
  description: {
    fontSize: T.fontBody,
    lineHeight: 19,
    color: T.textSecondary,
  },
  thumbSurface: {
    backgroundColor: T.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.labelOutline,
    overflow: 'hidden',
  },
});
