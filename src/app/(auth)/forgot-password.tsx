import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { ErrorBanner, TextField } from '@/components/ui/text-field';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { OtpInput } from '@/features/auth/components/otp-input';
import authService from '@/services/authService';
import {
  validateConfirmPassword,
  validateEmail,
  validatePassword,
} from '@/utils/validation';

const RESEND_COOLDOWN = 60;

type Step = 'email' | 'reset' | 'done';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const confirmRef = useRef<TextInput>(null);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const handleSendCode = async () => {
    Keyboard.dismiss();
    setServerError(null);
    const error = validateEmail(email);
    setEmailError(error);
    if (error) return;

    setIsSubmitting(true);
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      setStep('reset');
      setResendIn(RESEND_COOLDOWN);
    } catch (err: any) {
      setServerError(err?.message ?? 'Could not send the reset code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || isResending) return;
    setServerError(null);
    setIsResending(true);
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      setCode('');
      setResendIn(RESEND_COOLDOWN);
    } catch (err: any) {
      setServerError(err?.message ?? 'Could not resend the code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleReset = async () => {
    Keyboard.dismiss();
    setServerError(null);

    const pwdError = validatePassword(newPassword);
    const confError = validateConfirmPassword(newPassword, confirmPassword);
    setPasswordError(pwdError);
    setConfirmError(confError);
    if (code.length !== 6) {
      setServerError('Please enter the 6-digit code from your email.');
      return;
    }
    if (pwdError || confError) return;

    setIsSubmitting(true);
    try {
      await authService.resetPassword({
        email: email.trim().toLowerCase(),
        otp: code,
        newPassword,
      });
      setStep('done');
    } catch (err: any) {
      setServerError(err?.message ?? 'Could not reset your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <Ionicons
                name={step === 'done' ? 'checkmark-circle-outline' : 'key-outline'}
                size={30}
                color={step === 'done' ? Colors.light.success : Colors.light.primary}
              />
            </View>

            {step === 'email' && (
              <>
                <Text style={styles.title}>Forgot password?</Text>
                <Text style={styles.subtitle}>
                  Enter your account email and we&apos;ll send you a 6-digit reset code.
                </Text>
              </>
            )}
            {step === 'reset' && (
              <>
                <Text style={styles.title}>Enter reset code</Text>
                <Text style={styles.subtitle}>
                  If an account exists for{' '}
                  <Text style={styles.emailText}>{email.trim().toLowerCase()}</Text>, a code is on
                  its way. Enter it below with your new password.
                </Text>
              </>
            )}
            {step === 'done' && (
              <>
                <Text style={styles.title}>Password updated</Text>
                <Text style={styles.subtitle}>
                  Your password has been reset. Sign in with your new password.
                </Text>
              </>
            )}
          </Animated.View>

          {step !== 'done' ? (
            <View style={styles.card}>
              {serverError && <ErrorBanner message={serverError} />}

              {step === 'email' && (
                <>
                  <TextField
                    label="Email"
                    icon="mail-outline"
                    placeholder="you@example.com"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (emailError) setEmailError(null);
                    }}
                    error={emailError}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="go"
                    onSubmitEditing={handleSendCode}
                    editable={!isSubmitting}
                  />

                  <PrimaryButton
                    title="Send Reset Code"
                    onPress={handleSendCode}
                    loading={isSubmitting}
                    style={styles.submitButton}
                  />
                </>
              )}

              {step === 'reset' && (
                <>
                  <Text style={styles.otpLabel}>Reset code</Text>
                  <OtpInput
                    value={code}
                    onChange={(next) => {
                      setCode(next);
                      if (serverError) setServerError(null);
                    }}
                    disabled={isSubmitting}
                    error={Boolean(serverError)}
                    autoFocus
                  />

                  <View style={styles.resendRow}>
                    {resendIn > 0 ? (
                      <Text style={styles.resendHint}>Resend code in {resendIn}s</Text>
                    ) : (
                      <TouchableOpacity onPress={handleResend} disabled={isResending} hitSlop={8}>
                        <Text style={styles.resendLink}>
                          {isResending ? 'Sending…' : 'Resend code'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TextField
                    label="New password"
                    icon="lock-closed-outline"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      if (passwordError) setPasswordError(null);
                    }}
                    error={passwordError}
                    isPassword
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                    editable={!isSubmitting}
                  />

                  <TextField
                    ref={confirmRef}
                    label="Confirm new password"
                    icon="lock-closed-outline"
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (confirmError) setConfirmError(null);
                    }}
                    error={confirmError}
                    isPassword
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="go"
                    onSubmitEditing={handleReset}
                    editable={!isSubmitting}
                  />

                  <PrimaryButton
                    title="Reset Password"
                    onPress={handleReset}
                    loading={isSubmitting}
                    style={styles.submitButton}
                  />
                </>
              )}
            </View>
          ) : (
            <View style={styles.card}>
              <PrimaryButton
                title="Back to Sign In"
                onPress={() => router.replace('/login')}
              />
            </View>
          )}
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
  otpLabel: {
    ...Typography.bodyBold,
    color: Colors.light.text,
    marginBottom: Spacing.sm,
  },
  submitButton: {
    marginTop: Spacing.sm,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  resendHint: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  resendLink: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
});
