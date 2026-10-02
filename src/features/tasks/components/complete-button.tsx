import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

export type TaskActionState =
  | 'not_started'
  | 'starting'
  | 'in_progress'
  | 'completing'
  | 'celebrating'
  | 'done';

/** How long the parent should let `celebrating` run before settling to `done`. */
export const CELEBRATION_MS = 1400;

const CHECK_SIZE = 30;
const PARTICLE_COUNT = 18;
const CONFETTI_COLORS = [
  Colors.light.success,
  Colors.light.primary,
  Colors.light.warning,
  '#4C8DF6',
  '#E35D9A',
];

const LABELS: Record<TaskActionState, string> = {
  not_started: 'Start Task',
  starting: 'Starting…',
  in_progress: 'Complete Task',
  completing: 'Completing…',
  celebrating: 'Task Complete!',
  done: 'Completed',
};

/**
 * Single task action button: Start → In progress → Complete → celebration → Done.
 * The parent drives `state`; the celebration only plays on the transition to
 * `celebrating`, i.e. after the backend has confirmed the completion.
 */
export function TaskActionButton({
  state,
  onStart,
  onComplete,
}: {
  state: TaskActionState;
  onStart: () => void;
  onComplete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const press = useSharedValue(1);
  const spin = useSharedValue(0);
  const fill = useSharedValue(state === 'done' ? 1 : 0);
  const checkPop = useSharedValue(state === 'done' ? 1 : 0);
  const labelPop = useSharedValue(1);
  const ring = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const glow = useSharedValue(0);
  const burst = useSharedValue(0);

  const busy = state === 'starting' || state === 'completing';
  const celebrating = state === 'celebrating';
  const success = celebrating || state === 'done';
  const filled = state === 'in_progress' || state === 'completing';

  useEffect(() => {
    if (busy) {
      spin.set(0);
      spin.set(withRepeat(withTiming(1, { duration: 700, easing: Easing.linear }), -1, false));
    } else {
      cancelAnimation(spin);
    }
  }, [busy, spin]);

  useEffect(() => {
    if (celebrating) {
      fill.set(withSpring(1, { damping: 12, stiffness: 260 }));
      checkPop.set(withDelay(80, withSpring(1, { damping: 7, stiffness: 300 })));
      labelPop.set(
        withSequence(
          withTiming(0.7, { duration: 80 }),
          withSpring(1.08, { damping: 8, stiffness: 260 }),
          withSpring(1, { damping: 14 }),
        ),
      );
      if (!reduceMotion) {
        ring.set(0);
        ring.set(withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
        ring2.set(0);
        ring2.set(withDelay(140, withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) })));
        glow.set(0);
        glow.set(
          withSequence(
            withTiming(1, { duration: 220 }),
            withDelay(450, withTiming(0, { duration: 500 })),
          ),
        );
        burst.set(0);
        burst.set(withTiming(1, { duration: 950, easing: Easing.out(Easing.quad) }));
      }
    } else if (state === 'done') {
      fill.set(1);
      checkPop.set(1);
    } else {
      fill.set(withTiming(0, { duration: 150 }));
      checkPop.set(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.get() }],
    shadowColor: Colors.light.success,
    shadowOpacity: 0.5 * glow.get(),
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8 * glow.get(),
  }));
  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      fill.get(),
      [0, 1],
      [filled ? 'rgba(255,255,255,0.18)' : 'rgba(46,125,50,0)', Colors.light.success],
    ),
    borderColor: interpolateColor(
      fill.get(),
      [0, 1],
      [filled ? '#FFFFFF' : Colors.light.primary, Colors.light.success],
    ),
    transform: [{ scale: interpolate(fill.get(), [0, 0.6, 1], [1, 1.3, 1]) }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkPop.get(),
    transform: [
      { scale: interpolate(checkPop.get(), [0, 1], [0.2, 1]) },
      { rotate: `${interpolate(checkPop.get(), [0, 1], [-60, 0])}deg` },
    ],
  }));
  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.get() * 360}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.get(), [0, 0.15, 1], [0, 0.6, 0]),
    transform: [{ scale: interpolate(ring.get(), [0, 1], [0.8, 3.1]) }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.get(), [0, 0.15, 1], [0, 0.35, 0]),
    transform: [{ scale: interpolate(ring2.get(), [0, 1], [0.8, 4.2]) }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: labelPop.get() }],
  }));

  const actionable = state === 'not_started' || state === 'in_progress';

  return (
    <Animated.View style={containerStyle}>
      <Pressable
        onPress={state === 'not_started' ? onStart : state === 'in_progress' ? onComplete : undefined}
        disabled={!actionable}
        onPressIn={() => actionable && press.set(withTiming(0.96, { duration: 90 }))}
        onPressOut={() => press.set(withSpring(1, { damping: 14 }))}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: !actionable, checked: success }}
        accessibilityLabel={LABELS[state]}
        style={[
          styles.button,
          filled && styles.buttonFilled,
          success && styles.buttonSuccess,
          busy && styles.buttonBusy,
        ]}
      >
        <View style={styles.iconWrap}>
          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
          <Animated.View pointerEvents="none" style={[styles.ring, styles.ringThin, ring2Style]} />
          {celebrating &&
            !reduceMotion &&
            Array.from({ length: PARTICLE_COUNT }, (_, index) => (
              <Particle key={index} index={index} progress={burst} />
            ))}
          {busy ? (
            <Animated.View
              style={[styles.spinner, filled && styles.spinnerOnFilled, spinnerStyle]}
            />
          ) : state === 'not_started' ? (
            <View style={styles.playCircle}>
              <Ionicons name="play" size={13} color={Colors.light.primary} />
            </View>
          ) : (
            <Animated.View style={[styles.circle, circleStyle]}>
              <Animated.View style={checkStyle}>
                <Ionicons name="checkmark" size={19} color="#FFFFFF" />
              </Animated.View>
              {filled && !success && (
                <Ionicons
                  name="checkmark"
                  size={19}
                  color="#FFFFFF"
                  style={styles.checkHint}
                />
              )}
            </Animated.View>
          )}
        </View>
        <Animated.Text
          style={[
            styles.label,
            filled && styles.labelOnFilled,
            success && styles.labelSuccess,
            labelStyle,
          ]}
        >
          {LABELS[state]}
        </Animated.Text>
        <View style={styles.iconWrap}>
          {state === 'not_started' && (
            <Ionicons name="arrow-forward" size={16} color={Colors.light.primary} />
          )}
          {state === 'in_progress' && <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />}
          {state === 'done' && (
            <Ionicons name="ribbon-outline" size={16} color={Colors.light.success} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Particle({ index, progress }: { index: number; progress: SharedValue<number> }) {
  // Deterministic per-index spread so every burst looks balanced.
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2 + (index % 2 ? 0.25 : -0.12);
  const distance = 34 + (index % 4) * 12;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const shape = index % 4;
  const spinDir = index % 2 ? 1 : -1;

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const gravity = 22 * p * p;
    return {
      opacity: p === 0 ? 0 : interpolate(p, [0, 0.08, 0.7, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * distance * p },
        { translateY: Math.sin(angle) * distance * p + gravity },
        { rotate: `${spinDir * p * 320}deg` },
        { scale: interpolate(p, [0, 0.2, 1], [0.4, 1, 0.55]) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        shape === 0 ? styles.particleStrip : shape === 1 ? styles.particleDiamond : styles.particleDot,
        { backgroundColor: color },
        style,
      ]}
    />
  );
}

/** Animated "x of y done" bar that fills as tasks are completed. */
export function TaskProgress({ done, total }: { done: number; total: number }) {
  const progress = useSharedValue(0);
  const ratio = total > 0 ? done / total : 0;

  useEffect(() => {
    progress.set(withTiming(ratio, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [ratio, progress]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  if (total === 0) return null;
  const allDone = done === total;

  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHead}>
        <Ionicons
          name={allDone ? 'trophy' : 'flag-outline'}
          size={16}
          color={allDone ? Colors.light.warning : Colors.light.primary}
        />
        <Text style={styles.progressTitle}>
          {allDone ? 'All tasks complete — great work!' : `${done} of ${total} tasks done`}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, allDone && styles.progressFillDone, barStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.backgroundCard,
    minHeight: 52,
  },
  buttonFilled: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  buttonSuccess: {
    borderColor: Colors.light.success,
    backgroundColor: '#E5F1E6',
  },
  buttonBusy: {
    opacity: 0.85,
  },
  iconWrap: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  circle: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkHint: {
    position: 'absolute',
    opacity: 0.9,
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: Colors.light.primary,
    borderTopColor: 'transparent',
  },
  spinnerOnFilled: {
    borderColor: '#FFFFFF',
    borderTopColor: 'transparent',
  },
  ring: {
    position: 'absolute',
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    borderWidth: 3,
    borderColor: Colors.light.success,
  },
  ringThin: {
    borderWidth: 1.5,
  },
  particle: {
    position: 'absolute',
  },
  particleDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  particleStrip: {
    width: 3.5,
    height: 11,
    borderRadius: 1.75,
  },
  particleDiamond: {
    width: 8,
    height: 8,
    borderRadius: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  label: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
    flex: 1,
    textAlign: 'center',
  },
  labelOnFilled: {
    color: '#FFFFFF',
  },
  labelSuccess: {
    color: Colors.light.success,
  },
  progressCard: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.text,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.backgroundSecondary,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
  },
  progressFillDone: {
    backgroundColor: Colors.light.success,
  },
});
