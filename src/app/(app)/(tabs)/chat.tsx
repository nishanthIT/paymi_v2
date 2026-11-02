import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { selectChatFeed, type ChatSection } from '@/features/chat/feed';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import { deleteChat } from '@/features/chat/api';
import { ChatListSkeleton, ChatNotice } from '@/features/chat/components/chat-feedback';
import { NewChatSheet } from '@/features/chat/components/new-chat-sheet';
import { formatConversationDate } from '@/features/chat/dates';
import { getChatErrorState } from '@/features/chat/errors';
import { useChatConnection } from '@/features/chat/hooks/use-chat-connection';
import { useChats, useChatSearch } from '@/features/chat/hooks/use-chats';
import { chatKeys } from '@/features/chat/keys';
import { useOpenDirectChat } from '@/features/chat/hooks/use-open-direct-chat';
import { ChatColors as C, chatInitials } from '@/features/chat/theme';
import type { ChatSummary, DirectoryUser } from '@/features/chat/types';
import { matchesSearch } from '@/utils/search';

export default function ChatScreen() {
  const router = useRouter();
  const { activeSupermarket, shopsError, refreshSupermarkets } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const chatsQuery = useChats();
  const openDirectChat = useOpenDirectChat();
  const connection = useChatConnection();
  const [section, setSection] = useState<ChatSection>('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChatSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newChatVisible, setNewChatVisible] = useState(false);
  const searching = search.trim().length > 0;
  const searchQuery = useChatSearch(search, searching);
  const currentQuery = searching ? searchQuery : chatsQuery;
  const directoryError = chatsQuery.isError ? getChatErrorState(chatsQuery.error) : null;
  const error = directoryError?.accessDenied ? directoryError
    : currentQuery.isError ? getChatErrorState(currentQuery.error) : null;
  const searchPending = searching && (searchQuery.isDebouncing || searchQuery.isPlaceholderData);
  const localFallback = searching && !error?.accessDenied && (searchQuery.isError || searchQuery.isPaused);
  const chats = useMemo(() => {
    if (error?.accessDenied) return [];
    if (localFallback) return (chatsQuery.data ?? []).filter(chat => matchesSearch(search.trim(),
      chat.name, chat.lastMessage, ...chat.participants.map(person => person.name)));
    return (searching ? searchQuery.data : chatsQuery.data) ?? [];
  }, [chatsQuery.data, error?.accessDenied, localFallback, search, searchQuery.data, searching]);
  const visibleChats = useMemo(() => selectChatFeed(chats, activeSupermarket?.id, section),
    [chats, activeSupermarket?.id, section]);
  const loading = !!activeSupermarket && !currentQuery.isPaused && !error &&
    (searchPending || (currentQuery.isPending && !currentQuery.data));
  const refresh = useCallback(async () => {
    if (!activeSupermarket) { await refreshSupermarkets(); return; }
    await Promise.all([chatsQuery.refetch(), ...(searching ? [searchQuery.refetch()] : [])]);
  }, [activeSupermarket, chatsQuery, refreshSupermarkets, searchQuery, searching]);
  const openChat = useCallback(
    (chat: ChatSummary) => {
      router.push({
        pathname: '/(app)/chat/[id]',
        params: { id: chat.id, name: chat.name ?? 'Chat', type: chat.type },
      });
    },
    [router],
  );

  const handleLongPress = useCallback((chat: ChatSummary) => {
    if (chat.type === 'PERSONAL') setDeleteTarget(chat);
  }, []);
  const renderChat = useCallback(({ item }: { item: ChatSummary }) => (
    <ChatRow chat={item} onPress={openChat} onLongPress={handleLongPress} />
  ), [openChat, handleLongPress]);
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteChat(deleteTarget.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.all }),
        queryClient.invalidateQueries({ queryKey: chatKeys.searches }),
      ]);
      setDeleteTarget(null);
      showToast('Conversation deleted', 'success');
    } catch (error: any) {
      if (!error?.silent) showToast(error?.message ?? 'Delete failed', 'error');
    } finally { setDeleting(false); }
  };

  const handleSelectUser = useCallback((user: DirectoryUser) => {
    setNewChatVisible(false);
    openDirectChat(user);
  }, [openDirectChat]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text style={styles.eyebrow} numberOfLines={1}>{activeSupermarket?.name ?? 'Your workspace'}</Text>
            <Text accessibilityRole="header" style={styles.title}>Chats</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="New Chat"
            accessibilityState={{ disabled: !activeSupermarket }}
            disabled={!activeSupermarket} onPress={() => setNewChatVisible(true)}
            style={({ pressed }) => [styles.newChat, pressed && styles.pressed, !activeSupermarket && styles.disabled]}>
            <Ionicons name="create-outline" size={20} color={C.gold} />
            <Text style={styles.newChatText}>New chat</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}
          contentContainerStyle={styles.sections} accessibilityRole="tablist">
          {([{ id: 'all', label: 'All Chats' }, { id: 'team', label: 'Team Chat' },
            { id: 'direct', label: 'Direct' }, { id: 'unread', label: 'Unread' }] as const).map(tab => (
            <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: section === tab.id }}
              onPress={() => setSection(tab.id)} style={styles.sectionTab}>
              <Text style={[styles.sectionText, section === tab.id && styles.sectionTextSelected]}>{tab.label}</Text>
              {section === tab.id && <View style={styles.activeLine} />}
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={19} color={C.muted} />
          <TextInput accessibilityLabel="Search conversations and messages" style={styles.searchInput}
            value={search} onChangeText={setSearch} placeholder="Search people or messages"
            placeholderTextColor={C.muted} autoCorrect={false} autoCapitalize="none" returnKeyType="search" maxLength={200} />
          {searching && searchQuery.isFetching && <ActivityIndicator size="small" color={C.gold} />}
          {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} style={styles.clear}>
            <Ionicons name="close" size={18} color={C.textSecondary} />
          </Pressable>}
        </View>

        {!connection.isOnline || currentQuery.isPaused ? <ChatNotice title="You're offline"
          message={localFallback ? 'Showing matches in saved conversations. Full message search will resume when you reconnect.' : 'Saved conversations remain available. We’ll refresh when you reconnect.'} />
          : error ? <ChatNotice title={error.title} message={localFallback ? `${error.message} Showing matches in saved conversations only.` : error.message}
            action="Retry" busy={currentQuery.isFetching} onAction={error.retryable ? () => { void refresh(); } : undefined} />
          : null}

        <FlatList data={loading ? [] : visibleChats} keyExtractor={item => item.id}
          style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={currentQuery.isRefetching && !searchPending}
            onRefresh={async () => { try { await refresh(); } catch { showToast('Could not refresh your shop. Please try again.', 'error'); } }} tintColor={C.gold} colors={[C.gold]} />}
          ListHeaderComponent={searching && !loading && visibleChats.length ? <Text style={styles.resultsLabel}>Matching conversations · {visibleChats.length}</Text> : undefined}
          renderItem={renderChat}
          ListEmptyComponent={loading ? <ChatListSkeleton /> : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name={error ? 'cloud-offline-outline' : searching ? 'search-outline' : 'chatbubbles-outline'} size={28} color={C.gold} /></View>
              <Text style={styles.emptyTitle}>{!activeSupermarket ? 'Choose your shop' : error ? error.title : currentQuery.isPaused ? 'Waiting for a connection' : searching ? 'No matching conversations' : section === 'team' ? 'Team Chat unavailable' : section === 'unread' ? 'You’re all caught up' : 'Your conversations start here'}</Text>
              <Text style={styles.emptyBody}>{!activeSupermarket ? shopsError ?? 'Select an authorized shop in your profile to see its conversations.' : error ? error.message : currentQuery.isPaused ? 'Your conversations will load as soon as you’re back online.' : searching ? 'Try a teammate’s name or a different word from a message.' : section === 'team' ? 'Your shop’s shared conversation is not available. Ask your shop owner to check its setup.' : section === 'unread' ? 'There are no unread conversations in this shop.' : 'Start a conversation with someone in your shop.'}</Text>
              {!activeSupermarket ? <Pressable accessibilityRole="button" style={styles.emptyAction} onPress={() => router.push('/(app)/(tabs)/profile')}><Text style={styles.newChatText}>Open profile</Text></Pressable>
                : !error && !searching && (section === 'all' || section === 'direct') && !currentQuery.isPaused ? <Pressable accessibilityRole="button" style={styles.emptyAction} onPress={() => setNewChatVisible(true)}><Text style={styles.newChatText}>Start a chat</Text></Pressable> : null}
            </View>
          )}
        />
      </View>
      <BottomSheet visible={!!deleteTarget} onClose={() => { if (!deleting) setDeleteTarget(null); }}
        sheetStyle={{ width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: C.canvas }}>
        <View style={styles.deleteContent}>
          <Text style={styles.emptyTitle}>Delete conversation?</Text>
          <Text style={styles.emptyBody}>Messages with {deleteTarget?.name} will be removed.</Text>
          <View style={styles.deleteActions}>
            <Pressable accessibilityRole="button" disabled={deleting} onPress={() => setDeleteTarget(null)} style={styles.emptyAction}><Text style={styles.newChatText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Delete conversation" disabled={deleting} onPress={() => { void confirmDelete(); }} style={styles.emptyAction}>
              {deleting ? <ActivityIndicator color={C.danger} /> : <Text style={{ color: C.danger, fontWeight: '600' }}>Delete</Text>}
            </Pressable>
          </View>
        </View>
      </BottomSheet>
      <NewChatSheet visible={newChatVisible} onClose={() => setNewChatVisible(false)}
        onSelectUser={handleSelectUser} creating={false} />
    </SafeAreaView>
  );
}

const ChatRow = memo(function ChatRow({ chat, onPress, onLongPress }: { chat: ChatSummary; onPress: (chat: ChatSummary) => void; onLongPress: (chat: ChatSummary) => void }) {
  const group = chat.type === 'GROUP';
  const unread = chat.unreadCount > 0;
  return (
    <View style={styles.chatRow}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${chat.name || 'Chat'}${unread ? `, ${chat.unreadCount} unread messages` : ''}`}
      accessibilityHint={chat.isGlobalChat ? 'Open Global Chat for retail shop owners and employees' : group ? 'Open team conversation' : 'Open conversation. Hold for conversation options.'}
      onPress={() => onPress(chat)} onLongPress={() => onLongPress(chat)} delayLongPress={400}
      style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed]}>
      <View style={[styles.avatar, group && styles.groupAvatar]}>
        {group ? <Ionicons name={chat.isGlobalChat ? 'globe-outline' : 'people-outline'} size={23} color={C.gold} /> : <Text style={styles.avatarText}>{chatInitials(chat.name)}</Text>}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatTopRow}>
          <Text numberOfLines={1} style={[styles.chatName, unread && styles.chatNameUnread]}>{chat.name || 'Chat'}</Text>
          <Text style={[styles.chatWhen, unread && styles.chatWhenUnread]}>{formatConversationDate(chat.lastMessageTime ?? chat.lastActivityAt)}</Text>
        </View>
        <View style={styles.chatBottomRow}>
          <Text numberOfLines={1} style={[styles.chatPreview, unread && styles.chatPreviewUnread]}>{chat.lastMessage || (chat.isGlobalChat ? 'All retail shop owners and employees' : group ? `${chat.participantCount} members` : 'Start a conversation')}</Text>
          {unread && <View style={styles.unreadBadge}><Text style={styles.unreadText}>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</Text></View>}
        </View>
      </View>
    </Pressable>
      {!group && <Pressable accessibilityRole="button" accessibilityLabel={`Conversation options for ${chat.name}`}
        onPress={() => onLongPress(chat)} style={styles.rowOptions}>
        <Ionicons name="ellipsis-horizontal" size={16} color={C.muted} />
      </Pressable>}
    </View>
  );
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.canvas },
  frame: { flex: 1, width: '100%', maxWidth: 880, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 16 },
  heading: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { color: C.textSecondary, fontSize: 12, fontWeight: '500', letterSpacing: 0.3 },
  title: { color: C.text, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.8 },
  newChat: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 14, backgroundColor: C.goldSoft },
  newChatText: { fontSize: 13, fontWeight: '600', color: C.gold },
  pressed: { opacity: 0.7 }, disabled: { opacity: 0.45 },
  tabScroll: { flexGrow: 0, marginHorizontal: 22, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  sections: { flexDirection: 'row', flexGrow: 1, justifyContent: 'space-between', gap: 20 },
  sectionTab: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2, paddingBottom: 5 },
  sectionText: { color: C.textSecondary, fontSize: 13, fontWeight: '500' },
  sectionTextSelected: { color: C.gold, fontWeight: '700' },
  activeLine: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, backgroundColor: C.gold, borderRadius: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 22, marginBottom: 10, paddingLeft: 14, paddingRight: 4, minHeight: 46, backgroundColor: C.surfaceMuted, borderRadius: 14 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: C.text, paddingVertical: 12 },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 }, listContent: { flexGrow: 1, paddingBottom: 32 },
  resultsLabel: { fontSize: 12, color: C.textSecondary, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 4 },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 17, minHeight: 86 },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowOptions: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -14, marginLeft: -10 },
  deleteContent: { gap: 14, alignItems: 'center', paddingVertical: 20 },
  deleteActions: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  rowPressed: { backgroundColor: C.surfaceMuted },
  avatar: { width: 50, height: 50, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDE5' },
  groupAvatar: { backgroundColor: C.goldSoft },
  avatarText: { fontSize: 16, fontWeight: '600', color: '#686858' },
  chatInfo: { flex: 1, minWidth: 0, gap: 7 },
  chatTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatName: { flex: 1, color: C.text, fontSize: 15, fontWeight: '500', letterSpacing: -0.15 },
  chatNameUnread: { fontWeight: '700' },
  chatWhen: { color: C.muted, fontSize: 11 }, chatWhenUnread: { color: C.gold, fontWeight: '600' },
  chatBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 20 },
  chatPreview: { flex: 1, fontSize: 13, lineHeight: 19, color: C.textSecondary },
  chatPreviewUnread: { color: C.text, fontWeight: '500' },
  unreadBadge: { minWidth: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: C.gold },
  unreadText: { fontSize: 10, fontWeight: '700', color: C.surface },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32, paddingVertical: 48 },
  emptyIcon: { width: 64, height: 64, borderRadius: 24, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', color: C.text, letterSpacing: -0.3 },
  emptyBody: { maxWidth: 330, fontSize: 14, lineHeight: 22, color: C.textSecondary, textAlign: 'center' },
  emptyAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, marginTop: 4 },
});
