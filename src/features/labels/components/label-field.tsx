import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { LabelTokens as T } from '../tokens';

interface LabelFieldProps extends TextInputProps {
  label: string;
  helper?: string;
  error?: string;
  right?: React.ReactNode;
  /** Material style: label sits inside an empty, unfocused field and floats once filled. */
  inlineWhenEmpty?: boolean;
}

/** Rounded outlined field with a floating label on the border (R14/R16 style). */
export const LabelField = forwardRef<TextInput, LabelFieldProps>(
  ({ label, helper, error, right, style, onFocus, onBlur, inlineWhenEmpty, ...inputProps }, ref) => {
    const [focused, setFocused] = useState(false);
    const empty = !inputProps.value;
    const inline = !!inlineWhenEmpty && empty && !focused;
    return (
      <View style={styles.wrap}>
        <View
          style={[
            styles.box,
            focused && styles.boxFocused,
            !!error && styles.boxError,
          ]}
        >
          {!inline && (
            <Text style={[styles.floating, focused && styles.floatingFocused, !!error && styles.floatingError]}>
              {label}
            </Text>
          )}
          <TextInput
            ref={ref}
            style={[styles.input, style]}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...inputProps}
            placeholder={inline ? label : inputProps.placeholder}
            placeholderTextColor={inline ? T.textSecondary : T.textLight}
            accessibilityLabel={inputProps.accessibilityLabel ?? label}
          />
          {right}
        </View>
        {!!(error || helper) && (
          <Text style={[styles.helper, !!error && styles.helperError]}>{error ?? helper}</Text>
        )}
      </View>
    );
  },
);
LabelField.displayName = 'LabelField';

const styles = StyleSheet.create({
  wrap: {
    gap: 5,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderWidth: 1,
    borderColor: T.labelOutline,
    borderRadius: 12,
    backgroundColor: T.surface,
    paddingHorizontal: 14,
  },
  boxFocused: {
    borderColor: T.accent,
    borderWidth: 2,
    paddingHorizontal: 13,
  },
  boxError: {
    borderColor: T.error,
  },
  floating: {
    position: 'absolute',
    top: -9,
    left: 10,
    paddingHorizontal: 4,
    backgroundColor: T.surface,
    fontSize: 12,
    color: T.textSecondary,
  },
  floatingFocused: {
    color: T.accent,
  },
  floatingError: {
    color: T.error,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: T.text,
    paddingVertical: 14,
  },
  helper: {
    fontSize: T.fontDetail,
    color: T.textSecondary,
    paddingHorizontal: 4,
  },
  helperError: {
    color: T.error,
  },
});
