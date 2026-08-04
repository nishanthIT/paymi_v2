import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string | null;
  /** Renders an eye toggle and hides input text. */
  isPassword?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, icon, error, isPassword, ...inputProps }, ref) => {
    const [isHidden, setIsHidden] = useState(!!isPassword);

    // Focus styling is driven by a Reanimated shared value rather than React
    // state. Calling setState inside onFocus/onBlur re-renders during the
    // KeyboardAvoidingView animation on iOS (New Architecture), which blurs the
    // input and creates an endless keyboard open/close flicker loop.
    const focus = useSharedValue(0);

    const animatedWrapperStyle = useAnimatedStyle(() => ({
      borderColor: error
        ? Colors.light.error
        : interpolateColor(
            focus.value,
            [0, 1],
            [Colors.light.border, Colors.light.primary],
          ),
      shadowOpacity: 0.12 * focus.value,
      elevation: 2 * focus.value,
    }));

    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <Animated.View style={[styles.inputWrapper, animatedWrapperStyle]}>
          {icon && (
            <Ionicons
              name={icon}
              size={20}
              color={Colors.light.textLight}
              style={styles.icon}
            />
          )}
          <TextInput
            ref={ref}
            style={styles.input}
            placeholderTextColor={Colors.light.textLight}
            secureTextEntry={isHidden}
            onFocus={(e) => {
              focus.value = withTiming(1, { duration: 150 });
              inputProps.onFocus?.(e);
            }}
            onBlur={(e) => {
              focus.value = withTiming(0, { duration: 150 });
              inputProps.onBlur?.(e);
            }}
            {...inputProps}
          />
          {isPassword && (
            <TouchableOpacity
              onPress={() => setIsHidden((prev) => !prev)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isHidden ? 'Show password' : 'Hide password'}
            >
              <Ionicons
                name={isHidden ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={Colors.light.textLight}
              />
            </TouchableOpacity>
          )}
        </Animated.View>
        {!!error && (
          <Animated.Text entering={FadeInDown.duration(200)} style={styles.error}>
            {error}
          </Animated.Text>
        )}
      </View>
    );
  },
);

TextField.displayName = 'TextField';

/** Dismissible-style banner for form-level (server) errors. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.banner}>
      <Ionicons name="alert-circle" size={20} color={Colors.light.error} />
      <Text style={styles.bannerText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs + 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    minHeight: 54,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
  },
  icon: {
    marginRight: Spacing.sm + 2,
  },
  input: {
    ...Typography.body,
    flex: 1,
    color: Colors.light.text,
    paddingVertical: Spacing.sm,
  },
  error: {
    ...Typography.caption,
    color: Colors.light.error,
    marginTop: Spacing.xs + 2,
    marginLeft: Spacing.xs,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(185, 56, 42, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(185, 56, 42, 0.25)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
  },
  bannerText: {
    ...Typography.bodySmall,
    color: Colors.light.error,
    flex: 1,
  },
});
