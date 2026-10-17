import { usePrivateImage } from '@/hooks/use-private-image';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

interface ImageViewerProps {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
  /** Opt-in product popup; existing full-screen viewers keep their presentation. */
  presentation?: 'fullscreen' | 'preview';
}

const SPRING = { damping: 20, stiffness: 220 };
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * Full-screen photo viewer: pinch-to-zoom, double-tap zoom, pan while zoomed
 * and swipe-down to dismiss — all on the UI thread.
 */
export function ImageViewer({ uri, visible, onClose, presentation = 'fullscreen' }: ImageViewerProps) {
  const resolvedUri = usePrivateImage(uri);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const preview = presentation === 'preview';
  const imageWidth = preview ? Math.min(width - Spacing.lg * 2, 560) : width;
  const imageHeight = preview ? Math.min(imageWidth, height - insets.top - insets.bottom - 144) : height;
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

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
  }, [visible, uri]);

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
        translateX.set(clampPan(savedX.get() + event.translationX, imageWidth, scale.get()));
        translateY.set(clampPan(savedY.get() + event.translationY, imageHeight, scale.get()));
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
        const targetX = clampPan((imageWidth / 2 - event.x) * DOUBLE_TAP_SCALE, imageWidth, DOUBLE_TAP_SCALE);
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

  const image = (
    <GestureDetector gesture={composed}>
      <Animated.View style={preview ? styles.previewStage : styles.stage}>
        <Animated.View style={[{ width: imageWidth, height: imageHeight }, imageStyle]}>
          <Image
            source={resolvedUri ? { uri: resolvedUri } : null}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={180}
            accessibilityLabel={preview ? 'Product image preview' : undefined}
            onLoadStart={() => setImageStatus('loading')}
            onLoad={() => setImageStatus('loaded')}
            onError={() => setImageStatus('error')}
          />
        </Animated.View>
        {preview && imageStatus !== 'loaded' && (
          <View style={styles.imageStatus} pointerEvents="none">
            {imageStatus === 'loading' ? (
              <ActivityIndicator color={Colors.light.primary} size="large" />
            ) : (
              <>
                <Ionicons name="image-outline" size={36} color={Colors.light.textLight} />
                <Text style={styles.errorText}>Image unavailable</Text>
              </>
            )}
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );

  return (
    <Modal transparent statusBarTranslucent visible onRequestClose={close} animationType="none">
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, preview && styles.previewBackdrop, backdropStyle]}>
          {preview ? (
            <>
              <Pressable
                style={[StyleSheet.absoluteFill, styles.previewShade]}
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Close image preview"
              >
                {/* Native uses a softly blurred photo backdrop without a new native dependency. */}
                {Platform.OS !== 'web' && (
                  <Image
                    source={resolvedUri ? { uri: resolvedUri } : null}
                    style={[StyleSheet.absoluteFill, styles.blurredPhoto]}
                    contentFit="cover"
                    blurRadius={32}
                    cachePolicy="memory-disk"
                    accessible={false}
                    pointerEvents="none"
                  />
                )}
              </Pressable>
              <View style={styles.previewContent} pointerEvents="box-none">
                {image}
                <Text style={styles.previewHint} pointerEvents="none">Double-tap or pinch to zoom</Text>
              </View>
            </>
          ) : image}

          <Pressable
            onPress={close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close image"
            style={[styles.closeButton, { top: insets.top + 12 }]}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBackdrop: {
    backgroundColor: 'transparent',
    // Keep the blur on the modal surface so it samples the screen behind it.
    ...Platform.select({
      web: { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as ViewStyle,
    }),
  },
  previewShade: {
    backgroundColor: 'rgba(20, 18, 15, 0.68)',
  },
  blurredPhoto: {
    opacity: 0.22,
  },
  previewContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  previewStage: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  previewHint: {
    ...Typography.caption,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  imageStatus: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
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
