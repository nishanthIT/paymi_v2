import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';

/**
 * Invisible capture for keyboard-wedge (HID) handheld scanners. It only holds
 * focus while no other field is focused, so typing into a price/name field is
 * never treated as scanner input. Enter (or Tab-less burst ending in Enter)
 * submits one barcode.
 */
export function HandheldScanCapture({
  active,
  onBarcode,
}: {
  active: boolean;
  onBarcode: (barcode: string) => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!active) return;
    const tryFocus = () => {
      // Don't steal focus from a field the owner is typing into.
      const focusedInput = TextInput.State?.currentlyFocusedInput?.();
      if (!focusedInput) inputRef.current?.focus();
    };
    tryFocus();
    const timer = setInterval(tryFocus, 800);
    return () => clearInterval(timer);
  }, [active]);

  return (
    <TextInput
      ref={inputRef}
      value={value}
      onChangeText={setValue}
      onSubmitEditing={() => {
        const code = value.trim();
        setValue('');
        if (code) onBarcode(code);
      }}
      // No on-screen keyboard: the scanner types, not the owner.
      showSoftInputOnFocus={false}
      blurOnSubmit={false}
      autoCorrect={false}
      autoCapitalize="none"
      caretHidden
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={styles.hidden}
      {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})}
    />
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -100,
    top: 0,
  },
});
