import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ImageViewerProps {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}

const SPRING = { damping: 20, stiffness: 220 };
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * Full-screen photo viewer: pinch-to-zoom, double-tap zoom, pan while zoomed
 * and swipe-down to dismiss — all on the UI thread.
 */
export function ImageViewer({ uri, visible, onClose }: ImageViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const dismissY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.set(1);
      savedScale.set(1);
      translateX.set(0);
      translateY.set(0);
      savedX.set(0);
      savedY.set(0);
      dismissY.set(0);
      opacity.set(withTiming(1, { duration: 220 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => {
    opacity.set(withTiming(0, { duration: 160 }, (finished) => {
      'worklet';
      if (finished) runOnJS(onClose)();
    }));
  };

  const clampPan = (value: number, axisSize: number, currentScale: number) => {
    'worklet';
    const overflow = Math.max(0, (axisSize * currentScale - axisSize) / 2);
    return Math.min(overflow, Math.max(-overflow, value));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.set(Math.min(MAX_SCALE, Math.max(1, savedScale.get() * event.scale)));
    })
    .onEnd(() => {
      savedScale.set(scale.get());
      if (scale.get() <= 1.02) {
        scale.set(withSpring(1, SPRING));
        savedScale.set(1);
        translateX.set(withSpring(0, SPRING));
        translateY.set(withSpring(0, SPRING));
        savedX.set(0);
        savedY.set(0);
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.get() > 1.02) {
        // Pan within the zoomed image.
        translateX.set(clampPan(savedX.get() + event.translationX, width, scale.get()));
        translateY.set(clampPan(savedY.get() + event.translationY, height, scale.get()));
      } else if (event.translationY > 0) {
        // Swipe down to dismiss when not zoomed.
        dismissY.set(event.translationY);
        opacity.set(Math.max(0.35, 1 - event.translationY / 500));
      }
    })
    .onEnd((event) => {
      if (scale.get() > 1.02) {
        savedX.set(translateX.get());
        savedY.set(translateY.get());
      } else if (event.translationY > 130 || event.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        dismissY.set(withSpring(0, SPRING));
        opacity.set(withTiming(1, { duration: 160 }));
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.get() > 1.02) {
        scale.set(withSpring(1, SPRING));
        savedScale.set(1);
        translateX.set(withSpring(0, SPRING));
        translateY.set(withSpring(0, SPRING));
        savedX.set(0);
        savedY.set(0);
      } else {
        const targetX = clampPan((width / 2 - event.x) * DOUBLE_TAP_SCALE, width, DOUBLE_TAP_SCALE);
        scale.set(withSpring(DOUBLE_TAP_SCALE, SPRING));
        savedScale.set(DOUBLE_TAP_SCALE);
        translateX.set(withSpring(targetX, SPRING));
        savedX.set(targetX);
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dismissY.get() },
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: scale.get() },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
  }));

  if (!visible || !uri) return null;

  return (
    <Modal transparent statusBarTranslucent visible onRequestClose={close} animationType="none">
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <GestureDetector gesture={composed}>
          <Animated.View style={styles.stage}>
            <Animated.View style={[{ width, height }, imageStyle]}>
              <Image
                source={{ uri }}
                style={styles.image}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={180}
              />
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        <Pressable
          onPress={close}
          hitSlop={12}
          style={[styles.closeButton, { top: insets.top + 12 }]}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
