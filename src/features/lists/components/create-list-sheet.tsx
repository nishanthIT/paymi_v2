import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

const NAME_LIMIT = 50;

interface CreateListSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => void;
}

/** Bottom sheet for creating a list. Closes instantly (optimistic create). */
export function CreateListSheet({ visible, onClose, onCreate }: CreateListSheetProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setError(null);
    }
  }, [visible]);

  const handleCreate = () => {
    const clean = name.trim();
    if (!clean) {
      setError('Give your list a name');
      return;
    }
    onCreate(clean);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware>
      <Text style={styles.title}>New Shopping List</Text>
      <Text style={styles.subtitle}>Name it after a trip, day, or shop run.</Text>

      <View style={[styles.inputWrapper, !!error && styles.inputError]}>
        <TextInput
          value={name}
          onChangeText={(text) => {
            setName(text.slice(0, NAME_LIMIT));
            if (error) setError(null);
          }}
          placeholder="e.g. Weekly stock-up"
          placeholderTextColor={Colors.light.textLight}
          style={styles.input}
          autoFocus
          maxLength={NAME_LIMIT}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <Text style={styles.counter}>
          {name.length}/{NAME_LIMIT}
        </Text>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton title="Create List" onPress={handleCreate} />
        <PrimaryButton title="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    ...Typography.h3,
    color: Colors.light.text,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
  },
  inputError: {
    borderColor: Colors.light.error,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.light.text,
    paddingVertical: 14,
  },
  counter: {
    ...Typography.caption,
    color: Colors.light.textLight,
    marginLeft: Spacing.sm,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.light.error,
    marginTop: 6,
  },
  actions: {
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
});
