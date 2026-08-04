import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

import { useChatUserSearch } from '../hooks/use-chats';
import type { DirectoryUser } from '../types';

interface NewChatSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectUser: (user: DirectoryUser) => void;
  creating: boolean;
}

function monogram(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const ROLE_LABEL: Record<string, string> = {
  CUSTOMER: 'Owner',
  EMPLOYEE: 'Employee',
  ADMIN: 'Admin',
};

/** Start-a-new-chat sheet with live user directory search. */
export function NewChatSheet({ visible, onClose, onSelectUser, creating }: NewChatSheetProps) {
  const [search, setSearch] = useState('');
  const users = useChatUserSearch(search, visible);

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAware>
      <View style={styles.content}>
        <Text style={styles.title}>Start a new chat</Text>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={Colors.light.textLight} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or email"
            placeholderTextColor={Colors.light.textLight}
            autoCorrect={false}
          />
          {(users.isFetching || users.isDebouncing) && (
            <ActivityIndicator size="small" color={Colors.light.primary} />
          )}
        </View>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {users.isPending ? (
            <ActivityIndicator color={Colors.light.primary} style={{ marginTop: Spacing.lg }} />
          ) : (users.data?.length ?? 0) === 0 ? (
            <Text style={styles.empty}>No people found.</Text>
          ) : (
            (users.data ?? []).map((user) => (
              <Pressable
                key={`${user.userType}-${user.id}`}
                style={({ pressed }) => [styles.userRow, pressed && styles.userRowPressed]}
                disabled={creating}
                onPress={() => onSelectUser(user)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{monogram(user.name || '?')}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userMeta} numberOfLines={1}>
                    {user.phone}
                  </Text>
                </View>
                <View style={styles.rolePill}>
                  <Text style={styles.roleText}>{ROLE_LABEL[user.userType] ?? user.userType}</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  title: {
    ...Typography.h3,
    color: Colors.light.text,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    ...Typography.body,
    color: Colors.light.text,
  },
  list: {
    maxHeight: 380,
  },
  empty: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  userRowPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
  userName: {
    ...Typography.bodyBold,
    fontSize: 15,
    color: Colors.light.text,
  },
  userMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  rolePill: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  roleText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
});
