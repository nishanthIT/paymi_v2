import { Ionicons } from '@expo/vector-icons';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';

type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  /** Makes the toast tappable (e.g. navigate to the relevant screen). */
  onPress?: () => void;
  durationMs?: number;
}

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
  onPress?: () => void;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const ICON_COLORS: Record<ToastType, string> = {
  success: Colors.light.success,
  error: Colors.light.error,
  info: Colors.light.primary,
};

/** Non-blocking feedback pill shown at the top of the screen. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', options?: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), message, type, onPress: options?.onPress });
      timer.current = setTimeout(() => setToast(null), options?.durationMs ?? 2400);
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          key={toast.id}
          entering={FadeInUp.duration(250)}
          exiting={FadeOutUp.duration(200)}
          style={[styles.wrapper, { top: insets.top + Spacing.sm }]}
          pointerEvents={toast.onPress ? 'box-none' : 'none'}
        >
          <Pressable
            disabled={!toast.onPress}
            onPress={() => {
              const action = toast.onPress;
              setToast(null);
              action?.();
            }}
            style={({ pressed }) => [styles.toast, pressed && styles.toastPressed]}
          >
            <Ionicons name={ICONS[toast.type]} size={18} color={ICON_COLORS[toast.type]} />
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.onPress && (
              <Ionicons name="chevron-forward" size={14} color={Colors.light.textLight} />
            )}
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    maxWidth: '100%',
    ...Shadows.md,
  },
  toastPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  message: {
    ...Typography.bodySmall,
    color: Colors.light.text,
    fontWeight: '600',
    flexShrink: 1,
  },
});
