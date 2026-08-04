import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { validateEmail } from '@/utils/validation';

import type { Employee, EmployeeInput } from '../api';

interface EmployeeFormSheetProps {
  visible: boolean;
  /** When set, the sheet edits this employee instead of creating one. */
  employee?: Employee | null;
  onClose: () => void;
  onSubmit: (input: EmployeeInput) => Promise<void>;
  submitting: boolean;
}

/** Add / edit employee form. Password optional when editing. */
export function EmployeeFormSheet({
  visible,
  employee,
  onClose,
  onSubmit,
  submitting,
}: EmployeeFormSheetProps) {
  const isEdit = !!employee;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  useEffect(() => {
    if (visible) {
      setName(employee?.name ?? '');
      setEmail(employee?.email ?? '');
      setPassword('');
      setErrors({});
    }
  }, [visible, employee]);

  const handleSubmit = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Name is required';
    const emailError = validateEmail(email.trim());
    if (emailError) next.email = emailError;
    if (!isEdit && password.length < 6) next.password = 'At least 6 characters';
    if (isEdit && password.length > 0 && password.length < 6) next.password = 'At least 6 characters';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: EmployeeInput = { name: name.trim(), email: email.trim().toLowerCase() };
    if (password) input.password = password;
    await onSubmit(input);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware>
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={styles.content}>
        <Text style={styles.title}>{isEdit ? 'Edit Employee' : 'Add Employee'}</Text>
        <Text style={styles.subtitle}>
          {isEdit
            ? 'Update the account details for this team member.'
            : 'They will sign in with these credentials and can create lists and chat.'}
        </Text>

        <TextField
          label="Name"
          icon="person-outline"
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          error={errors.name}
          autoCapitalize="words"
        />
        <TextField
          label="Email (username)"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextField
          label={isEdit ? 'New password (optional)' : 'Password'}
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder={isEdit ? 'Leave blank to keep current' : 'Minimum 6 characters'}
          error={errors.password}
          isPassword
        />

        <PrimaryButton
          title={isEdit ? 'Save Changes' : 'Add Employee'}
          onPress={handleSubmit}
          loading={submitting}
        />
        <PrimaryButton title="Cancel" variant="ghost" onPress={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  title: {
    ...Typography.h3,
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.md,
  },
});
