import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, Spacing } from '@/constants/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Avoid keyboard (for sheets containing inputs). */
  keyboardAware?: boolean;
  /**
   * Wrap content in a ScrollView capped below screen height so every field
   * stays reachable while the keyboard is open. Use for multi-field forms.
   */
  scrollable?: boolean;
}

const SPRING = { damping: 22, stiffness: 260, mass: 0.9 };
const CLOSE_DURATION = 180;

/**
 * Lightweight, dependency-free bottom sheet: spring entrance, backdrop fade,
 * and drag-down to dismiss. Runs entirely on the UI thread.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  keyboardAware,
  scrollable,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(600);
  const backdrop = useSharedValue(0);

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.set(withSpring(0, SPRING));
      backdrop.set(withTiming(1, { duration: 220 }));
    } else if (mounted) {
      backdrop.set(withTiming(0, { duration: CLOSE_DURATION }));
      translateY.set(
        withTiming(600, { duration: CLOSE_DURATION }, (finished) => {
          'worklet';
          if (finished) runOnJS(unmount)();
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateY.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY > 120 || event.velocityY > 800) {
        runOnJS(onClose)();
      } else {
        translateY.set(withSpring(0, SPRING));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.get(),
  }));

  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  if (!mounted) return null;

  // The drag gesture is attached to the handle ONLY. Wrapping the whole sheet
  // (including its TextInputs) in a Pan detector makes iOS treat the first
  // touch on a field as a drag and immediately blur it — the keyboard opens
  // then instantly dismisses. Keeping the gesture on the handle fixes that
  // while preserving drag-to-dismiss.
  const sheet = (
    <Animated.View
      style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }, sheetStyle]}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
      </GestureDetector>
      {scrollable ? (
        <ScrollView
          style={{ maxHeight: windowHeight * 0.7 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </Animated.View>
  );

  return (
    <Modal transparent statusBarTranslucent visible onRequestClose={onClose} animationType="none">
      <View style={styles.container}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        {keyboardAware ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.avoider}
            pointerEvents="box-none"
          >
            {sheet}
          </KeyboardAvoidingView>
        ) : (
          sheet
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  avoider: {
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(26, 20, 8, 0.45)',
  },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  handleArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.border,
  },
});
