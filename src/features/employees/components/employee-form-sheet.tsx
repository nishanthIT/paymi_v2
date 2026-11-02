import { useQuery } from '@tanstack/react-query';
import { fetchAssignableEmployees } from '../api';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { validateEmail, validatePassword } from '@/utils/validation';

import type { Employee, EmployeeInput } from '../api';
import { defaultShopPermissions } from '../permissions';
import { EmployeeAccessEditor } from './employee-access-editor';

interface EmployeeFormSheetProps {
  visible: boolean;
  /** When set, the sheet edits this employee instead of creating one. */
  employee?: Employee | null;
  onClose: () => void;
  onSubmit: (input: EmployeeInput) => Promise<void>;
  submitting: boolean;
}

/** Add / edit a shop employee, including what they can do in each shop tool. */
export function EmployeeFormSheet({ visible, employee, onClose, onSubmit, submitting }: EmployeeFormSheetProps) {
  const isEdit = !!employee;
  const [existingId, setExistingId] = useState<number | null>(null);
  const assignable = useQuery({ queryKey: ['employees', 'assignable'], queryFn: fetchAssignableEmployees, enabled: visible && !isEdit });
  const credentialsLocked = !!employee?.credentialsLocked;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  // Reset the draft each time the sheet opens (for a new or different employee).
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = visible ? `${employee?.membershipId ?? 'new'}:${employee?.permissions?.join(',') ?? ''}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setExistingId(null);
      setName(employee?.name ?? '');
      setEmail(employee?.email ?? '');
      setPassword('');
      setPermissions(employee ? employee.permissions ?? [] : defaultShopPermissions());
      setErrors({});
    }
  }

  const handleSubmit = async () => {
    if (existingId) { await onSubmit({ name: '', existingEmployeeId: existingId, permissions }); return; }
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Name is required';
    const emailError = credentialsLocked ? null : validateEmail(email.trim());
    if (emailError) next.email = emailError;
    if (!credentialsLocked && (!isEdit || password.length > 0)) {
      const passwordError = validatePassword(password);
      if (passwordError) next.password = passwordError;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: EmployeeInput = { name: name.trim(), permissions };
    if (!credentialsLocked) {
      input.email = email.trim().toLowerCase();
      if (password) input.password = password;
    }
    await onSubmit(input);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware>
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={styles.content}>
        <Text style={styles.title}>{isEdit ? 'Edit Shop Employee' : 'Add Shop Employee'}</Text>
        <Text style={styles.subtitle}>
          {isEdit
            ? 'Update this team member. Changes apply to this shop only.'
            : 'They will sign in with these credentials and can only use this shop.'}
        </Text>

        {!isEdit && !!assignable.data?.length && <View style={{ marginBottom: Spacing.md }}>
          <Text style={styles.subtitle}>Or assign a team member from another of your shops:</Text>
          {assignable.data.map((person) => <Pressable key={person.id} accessibilityRole="button" accessibilityState={{ selected: existingId === person.id }} onPress={() => setExistingId(existingId === person.id ? null : person.id)} style={{ padding: 12, minHeight: 48, borderWidth: 1, borderRadius: 12, marginBottom: 6, borderColor: Colors.light.border, backgroundColor: existingId === person.id ? Colors.light.primaryLight : Colors.light.backgroundCard }}>
            <Text style={{ color: Colors.light.text, fontWeight: '600' }}>{person.name}{existingId === person.id ? ' ✓' : ''}</Text><Text style={{ color: Colors.light.textSecondary }}>{person.email}</Text>
          </Pressable>)}
        </View>}
        {!existingId && <><TextField
          label="Name"
          icon="person-outline"
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          error={errors.name}
          autoCapitalize="words"
        />
        {credentialsLocked ? (
          <Text style={styles.subtitle}>
            Login details for this account are managed outside your shop and can&apos;t be changed here.
          </Text>
        ) : (
          <>
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
          </>
        )}

        </>}

        <EmployeeAccessEditor value={permissions} onChange={setPermissions} />

        <PrimaryButton
          title={isEdit ? 'Save Changes' : existingId ? 'Assign to This Shop' : 'Add Employee'}
          onPress={handleSubmit}
          loading={submitting}
          style={styles.submit}
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
    maxHeight: 640,
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
  submit: {
    marginTop: Spacing.md,
  },
});
