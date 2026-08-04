import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

interface AnimatedSplashProps {
  /** When true, the overlay fades out and unmounts. */
  ready: boolean;
}

/**
 * Full-screen branded overlay shown while the session is being restored.
 * Takes over seamlessly from the native splash screen, plays a logo
 * entrance animation, then fades away once auth state is known.
 */
export function AnimatedSplash({ ready }: AnimatedSplashProps) {
  const [hidden, setHidden] = useState(false);

  const overlayOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.82);

  useEffect(() => {
    // Swap from the static native splash to this animated overlay.
    SplashScreen.hideAsync().catch(() => {});
    logoOpacity.set(withTiming(1, { duration: 350 }));
    logoScale.set(withSpring(1, { damping: 12, stiffness: 120 }));
  }, [logoOpacity, logoScale]);

  useEffect(() => {
    if (!ready) return;
    logoScale.set(withTiming(1.08, { duration: 450 }));
    overlayOpacity.set(
      withDelay(
        150,
        withTiming(0, { duration: 450 }, (finished) => {
          if (finished) runOnJS(setHidden)(true);
        }),
      ),
    );
  }, [ready, logoScale, overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.get(),
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.get(),
    transform: [{ scale: logoScale.get() }],
  }));

  if (hidden) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle]}>
      <Animated.View style={logoStyle}>
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  logo: {
    width: 180,
    height: 180,
  },
});
