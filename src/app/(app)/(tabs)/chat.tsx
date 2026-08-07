import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui/toast';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { deleteChat } from '@/features/chat/api';
import { NewChatSheet } from '@/features/chat/components/new-chat-sheet';
import { useChats, useCreateChat } from '@/features/chat/hooks/use-chats';
import type { ChatSummary, DirectoryUser } from '@/features/chat/types';
import { useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/features/chat/keys';

function monogram(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatWhen(timestamp?: string | null) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function isCommonChat(chat: ChatSummary) {
  return chat.type === 'GROUP' && chat.name === 'ALL Chat';
}

/**
 * Chat tab: pinned community + team group chats, direct conversations,
 * live previews and unread counts.
 */
export default function ChatScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const chatsQuery = useChats();
  const createChat = useCreateChat();

  const [search, setSearch] = useState('');
  const [newChatVisible, setNewChatVisible] = useState(false);

  const chats = useMemo(() => chatsQuery.data ?? [], [chatsQuery.data]);

  const { groups, personal } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? chats.filter(
          (c) =>
            c.name?.toLowerCase().includes(term) ||
            c.lastMessage?.toLowerCase().includes(term),
        )
      : chats;
    return {
      groups: filtered
        .filter((c) => c.type === 'GROUP')
        .sort((a, b) => Number(isCommonChat(b)) - Number(isCommonChat(a))),
      personal: filtered.filter((c) => c.type === 'PERSONAL'),
    };
  }, [chats, search]);

  const openChat = useCallback(
    (chat: ChatSummary) => {
      router.push({
        pathname: '/(app)/chat/[id]',
        params: { id: chat.id, name: chat.name ?? 'Chat', type: chat.type },
      });
    },
    [router],
  );

  const handleLongPress = useCallback(
    (chat: ChatSummary) => {
      if (chat.type !== 'PERSONAL') return;
      Alert.alert('Delete conversation?', `Messages with ${chat.name} will be removed.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChat(chat.id);
              queryClient.invalidateQueries({ queryKey: chatKeys.all });
              showToast('Conversation deleted', 'success');
            } catch (error: any) {
              if (!error?.silent) showToast(error?.message ?? 'Delete failed', 'error');
            }
          },
        },
      ]);
    },
    [queryClient, showToast],
  );

  const handleSelectUser = useCallback(
    (user: DirectoryUser) => {
      createChat.mutate(
        {
          type: 'PERSONAL',
          participantIds: [{ userId: Number(user.id), userType: user.userType }],
        },
        {
          onSuccess: (chat) => {
            setNewChatVisible(false);
            if (chat?.id) {
              router.push({
                pathname: '/(app)/chat/[id]',
                params: { id: chat.id, name: user.name, type: 'PERSONAL' },
              });
            }
          },
          onError: (error: any) => {
            if (!error?.silent) showToast(error?.message ?? 'Could not start chat', 'error');
          },
        },
      );
    },
    [createChat, router, showToast],
  );

  const sections = useMemo(() => {
    const rows: ({ kind: 'header'; title: string; id: string } | { kind: 'chat'; chat: ChatSummary; id: string })[] = [];
    if (groups.length > 0) {
      rows.push({ kind: 'header', title: 'Group chats', id: 'h-groups' });
      groups.forEach((chat) => rows.push({ kind: 'chat', chat, id: chat.id }));
    }
    if (personal.length > 0) {
      rows.push({ kind: 'header', title: 'Direct messages', id: 'h-direct' });
      personal.forEach((chat) => rows.push({ kind: 'chat', chat, id: chat.id }));
    }
    return rows;
  }, [groups, personal]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={Colors.light.textLight} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations"
          placeholderTextColor={Colors.light.textLight}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={Colors.light.textLight} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={chatsQuery.isRefetching}
            onRefresh={() => chatsQuery.refetch()}
            tintColor={Colors.light.primary}
          />
        }
        renderItem={({ item, index }) =>
          item.kind === 'header' ? (
            <Text style={styles.sectionHeader}>{item.title}</Text>
          ) : (
            <Animated.View
              entering={FadeInDown.duration(220).delay(Math.min(index * 30, 300))}
              layout={LinearTransition.springify().damping(26)}
            >
              <ChatRow
                chat={item.chat}
                onPress={() => openChat(item.chat)}
                onLongPress={() => handleLongPress(item.chat)}
              />
            </Animated.View>
          )
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          chatsQuery.isPending ? null : (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={40} color={Colors.light.textLight} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyBody}>Start a chat with your team below.</Text>
            </View>
          )
        }
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
        onPress={() => setNewChatVisible(true)}
      >
        <Ionicons name="chatbubble-ellipses" size={22} color="#FFFFFF" />
        <Text style={styles.fabText}>New Chat</Text>
      </Pressable>

      <NewChatSheet
        visible={newChatVisible}
        onClose={() => setNewChatVisible(false)}
        onSelectUser={handleSelectUser}
        creating={createChat.isPending}
      />
    </SafeAreaView>
  );
}

function ChatRow({
  chat,
  onPress,
  onLongPress,
}: {
  chat: ChatSummary;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const common = isCommonChat(chat);
  const isGroup = chat.type === 'GROUP';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => [styles.chatRow, pressed && styles.chatRowPressed]}
    >
      <View style={[styles.avatar, isGroup && styles.avatarGroup]}>
        {isGroup ? (
          <Ionicons
            name={common ? 'globe-outline' : 'people'}
            size={20}
            color={Colors.light.primary}
          />
        ) : (
          <Text style={styles.avatarText}>{monogram(chat.name || '?')}</Text>
        )}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatTopRow}>
          <Text style={styles.chatName} numberOfLines={1}>
            {chat.name || 'Chat'}
          </Text>
          <Text style={styles.chatWhen}>{formatWhen(chat.lastMessageTime)}</Text>
        </View>
        <View style={styles.chatBottomRow}>
          <Text
            style={[styles.chatPreview, chat.unreadCount > 0 && styles.chatPreviewUnread]}
            numberOfLines={1}
          >
            {chat.lastMessage ?? (isGroup ? `${chat.participantCount} members` : 'Say hello ')}
          </Text>
          {chat.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    color: Colors.light.text,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    ...Typography.body,
    color: Colors.light.text,
  },
  listContent: {
    paddingBottom: 120,
  },
  sectionHeader: {
    ...Typography.caption,
    fontWeight: '800',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
  },
  chatRowPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGroup: {
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  avatarText: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
  chatInfo: {
    flex: 1,
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    paddingBottom: Spacing.sm,
  },
  chatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  chatName: {
    ...Typography.bodyBold,
    fontSize: 15,
    color: Colors.light.text,
    flexShrink: 1,
  },
  chatWhen: {
    ...Typography.caption,
    color: Colors.light.textLight,
  },
  chatBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chatPreview: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  chatPreviewUnread: {
    color: Colors.light.text,
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h4,
    color: Colors.light.text,
  },
  emptyBody: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    height: 52,
    ...Shadows.lg,
  },
  fabText: {
    ...Typography.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
