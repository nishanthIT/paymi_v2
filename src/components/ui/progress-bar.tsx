import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BorderRadius, Colors } from '@/constants/theme';

interface ProgressBarProps {
  /** 0..1 */
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: ViewStyle;
}

/** Smoothly animated horizontal progress bar (UI-thread only). */
export function ProgressBar({
  progress,
  height = 8,
  color = Colors.light.primary,
  trackColor = Colors.light.backgroundSecondary,
  style,
}: ProgressBarProps) {
  const fraction = useSharedValue(Math.min(1, Math.max(0, progress)));

  useEffect(() => {
    fraction.set(withTiming(Math.min(1, Math.max(0, progress)), { duration: 450 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fraction.get() * 100}%`,
  }));

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
});
