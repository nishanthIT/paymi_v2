import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

const OTP_LENGTH = 6;

interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  /** Fired once the full 6-digit code has been entered. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

/**
 * Six-box OTP input backed by a single hidden TextInput, so paste,
 * autofill (one-time-code) and the number pad all work naturally.
 */
export function OtpInput({ value, onChange, onComplete, disabled, error, autoFocus = true }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(digits);
    if (digits.length === OTP_LENGTH) {
      onComplete?.(digits);
    }
  };

  const boxes = Array.from({ length: OTP_LENGTH }, (_, i) => {
    const char = value[i] ?? '';
    const isActive = focused && i === Math.min(value.length, OTP_LENGTH - 1);
    return (
      <View
        key={i}
        style={[
          styles.box,
          isActive && styles.boxActive,
          error && styles.boxError,
        ]}
      >
        <Text style={styles.digit}>{char}</Text>
        {isActive && char === '' && <View style={styles.caret} />}
      </View>
    );
  });

  return (
    <Pressable
      style={styles.row}
      onPress={() => inputRef.current?.focus()}
      accessibilityLabel="Verification code input"
    >
      {boxes}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        editable={!disabled}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  box: {
    width: 46,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: Colors.light.primary,
  },
  boxError: {
    borderColor: Colors.light.error,
  },
  digit: {
    ...Typography.h3,
    color: Colors.light.text,
  },
  caret: {
    position: 'absolute',
    width: 2,
    height: 24,
    backgroundColor: Colors.light.primary,
    borderRadius: 1,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});
