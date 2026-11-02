import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Small visual feedback only; navigation and data stay with each caller. */
export function HomeAction({
  children,
  label,
  hint,
  onPress,
  style,
}: {
  children: React.ReactNode;
  label: string;
  hint?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const pressed = useSharedValue(0);
  const feedback = useAnimatedStyle(() => ({
    opacity: 1 - pressed.get() * 0.12,
    transform: [{ scale: 1 - pressed.get() * 0.015 }],
  }));
  const animatePress = (value: number) => {
    pressed.set(withTiming(value, { duration: 120, reduceMotion: ReduceMotion.System }));
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      onPressIn={() => animatePress(1)}
      onPressOut={() => animatePress(0)}
      style={[style, feedback]}
    >
      {children}
    </AnimatedPressable>
  );
}
