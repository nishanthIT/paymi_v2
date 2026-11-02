import { Link } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  type TextInputInstance,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { ErrorBanner, TextField } from '@/components/ui/text-field';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { validateEmail } from '@/utils/validation';

export default function LoginScreen() {
  const { login } = useAuth();
  const passwordRef = useRef<TextInputInstance>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    Keyboard.dismiss();
    setServerError(null);

    const errors = {
      email: validateEmail(email),
      password: password ? null : 'Please enter your password',
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setIsSubmitting(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      // Navigation is handled by the protected route guards.
    } catch (error: any) {
      setServerError(error?.message ?? 'Login failed. Please try again.');
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
          <Animated.View entering={FadeInUp.duration(500)} style={styles.header}>
            <Text style={styles.title}>Welcome to Paymi</Text>
            <Link href="/promotions" style={{ color: Colors.light.primary, padding: Spacing.md }}>Browse promotions without signing in</Link>
            <Text style={styles.subtitle}>
              Sign in to manage your shop with Paymi
            </Text>
          </Animated.View>

          {/* No entering animation here: animating an ancestor of a TextInput
              re-parents the native view and blurs the input mid-tap. */}
          <View style={styles.card}>
            {serverError && <ErrorBanner message={serverError} />}

            <TextField
              label="Email"
              icon="mail-outline"
              placeholder="you@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: null }));
              }}
              error={fieldErrors.email}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!isSubmitting}
            />

            <TextField
              ref={passwordRef}
              label="Password"
              icon="lock-closed-outline"
              placeholder="Your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: null }));
              }}
              error={fieldErrors.password}
              isPassword
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              editable={!isSubmitting}
            />

            <Link href="/forgot-password" style={styles.forgotLink}>
              Forgot password?
            </Link>

            <PrimaryButton
              title="Sign In"
              onPress={handleLogin}
              loading={isSubmitting}
              style={styles.submitButton}
            />
          </View>

          <Animated.View entering={FadeInDown.duration(500).delay(240)} style={styles.footer}>
            <Text style={styles.footerText}>New to Paymi?</Text>
            <Link href="/register" style={styles.footerLink}>
              Create an account
            </Link>
          </Animated.View>
          <Link href="/about" style={{ textAlign: 'center', padding: 16, color: Colors.light.primary }}>About Paymi · Support & privacy</Link>
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
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h2,
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
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
    marginTop: Spacing.sm,
  },
  forgotLink: {
    ...Typography.bodySmall,
    color: Colors.light.primary,
    fontWeight: '600',
    alignSelf: 'flex-end',
    marginTop: -Spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginTop: Spacing.lg,
  },
  footerText: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  footerLink: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
});
