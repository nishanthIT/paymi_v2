import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useAuth } from '@/contexts/AuthContext';
import { getChatErrorState } from '../errors';
import { useChatUserSearch } from '../hooks/use-chats';
import { ChatColors as C, chatInitials } from '../theme';
import type { DirectoryUser } from '../types';
import { ChatListSkeleton, ChatNotice } from './chat-feedback';

interface NewChatSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectUser: (user: DirectoryUser) => void;
  creating: boolean;
}

const ROLE_LABEL: Record<string, string> = { CUSTOMER: 'Owner', EMPLOYEE: 'Employee' };

/** A live, authorized shop directory. No placeholder people or inferred access. */
export function NewChatSheet({ visible, onClose, onSelectUser, creating }: NewChatSheetProps) {
  const { activeSupermarket } = useAuth();
  const [search, setSearch] = useState('');
  const users = useChatUserSearch(search, visible);
  const error = users.isError ? getChatErrorState(users.error) : null;
  const waiting = !users.isPaused && !!activeSupermarket &&
    (users.isPending || users.isDebouncing || users.isPlaceholderData);
  const staleResults = users.isDebouncing || users.isPlaceholderData;
  const people = !activeSupermarket || error?.accessDenied || waiting || staleResults ? [] : users.data ?? [];
  const close = () => { setSearch(''); onClose(); };

  return (
    <BottomSheet visible={visible} onClose={close} keyboardAware scrollable
      sheetStyle={styles.sheet}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>New chat</Text>
            <Text numberOfLines={1} style={styles.subtitle}>Retail shop owners and employees</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close new chat" style={styles.iconButton} onPress={close}>
            <Ionicons name="close" size={22} color={C.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={C.muted} />
          <TextInput accessibilityLabel="Search shop users" style={styles.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search by name" placeholderTextColor={C.muted} autoCorrect={false} autoCapitalize="none" maxLength={200} />
          {(users.isFetching || users.isDebouncing) && <ActivityIndicator size="small" color={C.gold} />}
          {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear teammate search" onPress={() => setSearch('')} style={styles.iconButton}>
            <Ionicons name="close" size={17} color={C.textSecondary} />
          </Pressable>}
        </View>
        {creating && <View accessibilityLiveRegion="polite" style={styles.creating}>
          <ActivityIndicator size="small" color={C.gold} /><Text style={styles.subtitle}>Opening conversation…</Text>
        </View>}
        {users.isPaused ? <ChatNotice title="Waiting for a connection" message="Contacts will refresh when you’re back online." />
          : error ? <ChatNotice title={error.title} message={error.message} onAction={error.retryable ? () => { void users.refetch(); } : undefined} busy={users.isFetching} /> : null}
        {waiting ? <ChatListSkeleton count={3} /> : people.length ? people.map(user => (
          <Pressable key={`${user.userType}-${user.id}`} accessibilityRole="button" accessibilityLabel={`Message ${user.name}`}
            accessibilityState={{ disabled: creating }} disabled={creating} onPress={() => onSelectUser(user)}
            style={({ pressed }) => [styles.userRow, pressed && styles.pressed, creating && styles.disabled]}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{chatInitials(user.name)}</Text></View>
            <View style={styles.userCopy}>
              <Text numberOfLines={1} style={styles.userName}>{user.name}</Text>
              <Text numberOfLines={1} style={styles.userMeta}>{ROLE_LABEL[user.userType] ?? user.userType}{user.phone ? ` · ${user.phone}` : ''}</Text>
            </View>
            <Ionicons name="chatbubble-outline" size={18} color={C.gold} />
          </Pressable>
        )) : !error && !users.isPaused ? <View style={styles.empty}>
          <Ionicons name="people-outline" size={26} color={C.gold} />
          <Text style={styles.emptyTitle}>{activeSupermarket ? 'No people found' : 'Choose your shop first'}</Text>
          <Text style={styles.emptyText}>{search ? 'Try another name.' : 'Eligible owners and employees from retail shops appear here.'}</Text>
        </View> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: C.canvas, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 },
  content: { paddingBottom: 12, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heading: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontSize: 23, fontWeight: '600', color: C.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: C.textSecondary },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 4, backgroundColor: C.surfaceMuted, borderRadius: 14 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 13, fontSize: 14, color: C.text },
  creating: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 66, paddingVertical: 8, paddingHorizontal: 3, borderRadius: 14 },
  pressed: { backgroundColor: C.surfaceMuted }, disabled: { opacity: 0.5 },
  avatar: { width: 44, height: 44, borderRadius: 17, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '600', color: C.gold },
  userCopy: { flex: 1, minWidth: 0, gap: 5 },
  userName: { fontSize: 15, fontWeight: '500', color: C.text },
  userMeta: { fontSize: 12, color: C.textSecondary },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  emptyText: { fontSize: 13, lineHeight: 20, color: C.textSecondary, textAlign: 'center' },
});
