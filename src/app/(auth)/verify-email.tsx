import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { ErrorBanner } from '@/components/ui/text-field';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { OtpInput } from '@/features/auth/components/otp-input';
import {
  clearPendingRegistration,
  getPendingRegistration,
} from '@/features/auth/pending-registration';
import authService from '@/services/authService';
const RESEND_COOLDOWN = 60;

export default function VerifyEmailScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const pending = getPendingRegistration();

  const [code, setCode] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN);

  // If someone lands here without pending details, send them back.
  useEffect(() => {
    if (!pending) {
      router.replace('/register');
    }
  }, [pending, router]);

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const handleVerify = useCallback(
    async (otp: string) => {
      if (!pending || otp.length !== 6 || isSubmitting) return;
      Keyboard.dismiss();
      setServerError(null);
      setIsSubmitting(true);
      try {
        await register({ ...pending, otp });
        clearPendingRegistration();
        // Navigation is handled by the protected route guards.
      } catch (error: any) {
        setServerError(error?.message ?? 'Verification failed. Please try again.');
        setCode('');
      } finally {
        setIsSubmitting(false);
      }
    },
    [pending, register, isSubmitting]
  );

  const handleResend = async () => {
    if (!pending || resendIn > 0 || isResending) return;
    setServerError(null);
    setIsResending(true);
    try {
      await authService.sendRegisterOtp(pending);
      setCode('');
      setResendIn(RESEND_COOLDOWN);
    } catch (error: any) {
      setServerError(error?.message ?? 'Could not resend the code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  if (!pending) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp.duration(500)}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
            </TouchableOpacity>

            <View style={styles.iconBadge}>
              <Ionicons name="mail-open-outline" size={30} color={Colors.light.primary} />
            </View>

            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.emailText}>{pending.email}</Text>
            </Text>
          </Animated.View>

          <View style={styles.card}>
            {serverError && <ErrorBanner message={serverError} />}

            <OtpInput
              value={code}
              onChange={(next) => {
                setCode(next);
                if (serverError) setServerError(null);
              }}
              onComplete={handleVerify}
              disabled={isSubmitting}
              error={Boolean(serverError)}
            />

            <PrimaryButton
              title="Verify & Create Account"
              onPress={() => handleVerify(code)}
              loading={isSubmitting}
              disabled={code.length !== 6}
              style={styles.submitButton}
            />

            <View style={styles.resendRow}>
              {resendIn > 0 ? (
                <Text style={styles.resendHint}>
                  Resend code in {resendIn}s
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResend} disabled={isResending} hitSlop={8}>
                  <Text style={styles.resendLink}>
                    {isResending ? 'Sending…' : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.changeEmail}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Text style={styles.changeEmailText}>Wrong email? Go back and edit</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.lg,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.light.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  title: {
    ...Typography.h2,
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  emailText: {
    ...Typography.bodyBold,
    color: Colors.light.text,
  },
  card: {
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  resendHint: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  resendLink: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
  changeEmail: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  changeEmailText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textDecorationLine: 'underline',
  },
});
