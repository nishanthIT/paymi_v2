import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { getChatSocket } from '@/features/chat/socket';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui/toast';
import { Spacing, Typography } from '@/constants/theme';
import { uploadChatFile } from '@/features/chat/api';
import { MessageTimeline, MessageTimelineSkeleton } from '@/features/chat/components/message-timeline';
import { ChatCamera } from '@/features/chat/components/chat-camera';
import { createPhotoSendSession, type ChatPhoto } from '@/features/chat/photo-send';
import { getSupermarketScope } from '@/features/supermarkets/scope';
import {
  useChatThread,
  useChatMessageSearch,
  useDeleteMessage,
  useSendMessage,
  useThreadRealtime,
  useTypingEmitter,
} from '@/features/chat/hooks/use-chat-thread';
import type { ChatMessage } from '@/features/chat/types';
import { ChatColors } from '@/features/chat/theme';
import { getChatErrorState } from '@/features/chat/errors';
import { useChatConnection } from '@/features/chat/hooks/use-chat-connection';
import { useOpenDirectChat } from '@/features/chat/hooks/use-open-direct-chat';

/**
 * Message thread: realtime, optimistic sends, typing indicator, read
 * receipts, image attachments and infinite history.
 */
type MessageAction = { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void };

export default function ChatThreadScreen() {
  const { id, name, type } = useLocalSearchParams<{ id: string; name?: string; type?: string }>();
  const chatId = id ?? '';
  const router = useRouter();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const thread = useChatThread(chatId);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageQuery, setMessageQuery] = useState('');
  const messageSearch = useChatMessageSearch(chatId, messageQuery, searchOpen);
  const { isOnline, isConnected } = useChatConnection();
  const send = useSendMessage(chatId);
  const photoSend = useSendMessage(chatId, { retainFailedMessage: false });
  const deleteMessage = useDeleteMessage(chatId);
  const { mutate: sendMessage } = send;
  const { mutate: removeMessage } = deleteMessage;
  const openDirectChat = useOpenDirectChat();
  const { typingUsers } = useThreadRealtime(chatId, thread.messages);
  const { onInputChange } = useTypingEmitter(chatId);

  const safety = useQuery({ queryKey: ['chat-safety'], queryFn: async () => (await api.get('/chat-safety')).data, refetchInterval: 15000 });
  const suspension = safety.data?.suspension;
  const restricted = !!suspension;
  const { refetch: refetchSafety } = safety;
  useEffect(() => {
    if (!suspension?.until) return;
    const timer = setTimeout(() => { void refetchSafety(); }, Math.min(2147483647, Math.max(0, Date.parse(suspension.until) - Date.now()) + 50));
    return () => clearTimeout(timer);
  }, [suspension?.until, refetchSafety]);
  useEffect(() => {
    let disposed = false; let cleanup = () => {};
    getChatSocket().then(socket => {
      if (!socket || disposed) return;
      const refresh = () => { void refetchSafety(); };
      socket.on('chat_suspended', refresh); cleanup = () => { socket.off('chat_suspended', refresh); };
    });
    return () => { disposed = true; cleanup(); };
  }, [refetchSafety]);

  const [menuActions, setMenuActions] = useState<MessageAction[]>([]);
  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const attachmentBusy = useRef(false);
  const photoSession = useRef<{ chatId: string; uri: string; send: () => Promise<void>; cancel: () => void } | null>(null);
  const canSendPhoto = useRef(false);
  const activeChatId = useRef<string | null>(null);
  const threadError = getChatErrorState(thread.error);
  const searching = searchOpen && !!messageQuery.trim();
  const searchSettling = searching && messageSearch.isDebouncing;
  const displayedThread = searching ? messageSearch : thread;
  const loadOlder = useCallback(() => { void displayedThread.fetchNextPage(); }, [displayedThread.fetchNextPage]);
  const displayedError = getChatErrorState(displayedThread.error);
  const threadAccessDenied = thread.isError && threadError.accessDenied;
  const accessDenied = threadAccessDenied || (displayedThread.isError && displayedError.accessDenied);
  const accessError = threadAccessDenied ? threadError : displayedError;
  // A failed background refresh must not erase already-loaded history or drafts.
  // Access errors still close the conversation immediately.
  const messagingUnavailable = restricted || accessDenied || !thread.data;
  const initialError = accessDenied || (!searchSettling && displayedThread.isError && !displayedThread.data);
  const backgroundError = !searchSettling && displayedThread.isError && !!displayedThread.data && !displayedThread.isFetchNextPageError && !accessDenied;
  const waitingForConnection = displayedThread.isPaused && (!displayedThread.data || searchSettling);
  const connectionMessage = !isOnline
    ? 'You’re offline. Messages will sync when you reconnect.'
    : backgroundError
      ? 'Your messages are saved here. Refresh to catch up.'
      : !isConnected && thread.data
        ? 'Reconnecting to live updates…'
        : '';
  useEffect(() => {
    activeChatId.current = chatId;
    canSendPhoto.current = isFocused && !messagingUnavailable;
    return () => { canSendPhoto.current = false; activeChatId.current = null; };
  }, [isFocused, messagingUnavailable, chatId]);

  const closeCamera = useCallback(() => {
    photoSession.current?.cancel();
    photoSession.current = null;
    setCameraOpen(false);
  }, []);
  // Closing a pending upload must not send a photo later or alter the text draft.
  useEffect(() => () => { closeCamera(); }, [isFocused, messagingUnavailable, chatId, closeCamera]);

  const handleCameraPhoto = useCallback((photo: ChatPhoto) => {
    if (photoSession.current?.uri !== photo.uri || photoSession.current.chatId !== chatId) {
      const generation = getSupermarketScope().generation;
      const session = createPhotoSendSession(photo, {
        upload: uploadChatFile,
        send: photoSend.mutateAsync,
        canSend: () => canSendPhoto.current && activeChatId.current === chatId && generation === getSupermarketScope().generation,
      });
      photoSession.current = { chatId, uri: photo.uri, send: session.send, cancel: session.cancel };
    }
    return photoSession.current.send();
  }, [photoSend.mutateAsync, chatId]);

  const isGroup = (thread.chatType ?? type) === 'GROUP';
  const title = thread.chatName ?? name ?? 'Chat';
  const subtitle =
    typingUsers.length > 0
      ? `${typingUsers.join(', ')} ${typingUsers.length === 1 ? 'is' : 'are'} typing…`
      : isGroup
        ? `${thread.participants.length || '…'} members`
        : 'Direct message';

  const handleChangeText = useCallback(
    (text: string) => {
      setDraft(text);
      if (!restricted) onInputChange(text);
    },
    [onInputChange, restricted],
  );

  const handleSend = useCallback(() => {
    const content = draft.trim();
    if (!content || messagingUnavailable) return;
    setDraft('');
    send.mutate(
      { content },
      {
        onError: (error: any) => {
          if (!error?.silent) showToast(error?.message ?? 'Message failed to send', 'error');
        },
      },
    );
  }, [draft, send, showToast, messagingUnavailable]);

  const handleAttachImage = useCallback(async () => {
    if (messagingUnavailable || attachmentBusy.current) return;
    attachmentBusy.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0] || !canSendPhoto.current || activeChatId.current !== chatId) return;
      const asset = result.assets[0];
      setUploading(true);
      const file = await uploadChatFile(
        asset.uri,
        asset.fileName ?? `photo-${Date.now()}.jpg`,
        asset.mimeType ?? 'image/jpeg',
      );
      if (!canSendPhoto.current || activeChatId.current !== chatId) return;
      await send.mutateAsync(
        {
          content: file.name,
          messageType: file.type,
          attachmentUrl: file.url,
          attachmentName: file.name,
          attachmentSize: file.size,
        },
      );
    } catch (error: any) {
      if (!error?.silent) showToast(error?.message ?? 'Image failed to send', 'error');
    } finally {
      attachmentBusy.current = false;
      setUploading(false);
    }
  }, [send, showToast, messagingUnavailable, chatId]);

  const handleLongPress = useCallback(
    (message: ChatMessage) => {
      const actions: MessageAction[] = [];
      if (thread.chatType === 'GROUP' && !message.isOwnMessage && !messagingUnavailable &&
        thread.participants.some(person => Number(person.id) === message.senderId && person.userType === message.senderType)) {
        actions.push({ text: 'Message personally', onPress: () => {
          openDirectChat({ id: String(message.senderId), name: message.senderName, userType: message.senderType });
        } });
      }
      if (!message.isOwnMessage && !message.pending) {
        actions.push({ text: 'Report Message', onPress: () => router.push({ pathname: '/chat-safety', params: { messageId: message.id } }) });
      }
      if (message.content && message.messageType === 'TEXT') {
        actions.push({
          text: 'Copy',
          onPress: () => {
            Clipboard.setStringAsync(message.content).then(() =>
              showToast('Copied to clipboard', 'info'),
            );
          },
        });
      }
      if (message.failed && !restricted) {
        actions.push({
          text: 'Retry send',
          onPress: () => {
            removeMessage(message.id);
            sendMessage({
              clientMessageId: message.clientMessageId ?? undefined,
              content: message.content,
              messageType: message.messageType,
              attachmentUrl: message.attachmentUrl ?? undefined,
              attachmentName: message.attachmentName ?? undefined,
              attachmentSize: message.attachmentSize ?? undefined,
            });
          },
        });
      }
      if (message.isOwnMessage && !message.pending) {
        actions.push({
          text: 'Delete message',
          style: 'destructive',
          onPress: () =>
            removeMessage(message.id, {
              onError: (error: any) => {
                if (!error?.silent) showToast(error?.message ?? 'Delete failed', 'error');
              },
            }),
        });
      }
      if (actions.length === 0) return;
      actions.push({ text: 'Cancel', style: 'cancel' });
      setMenuActions(actions);
    },
    [removeMessage, sendMessage, showToast, router, restricted, thread.chatType, thread.participants, messagingUnavailable, openDirectChat],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.headerSurface}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to conversations"
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/chat')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <Ionicons name="chevron-back" size={23} color={ChatColors.text} />
          </Pressable>
          <View style={styles.headerAvatar}>
            {isGroup ? <Ionicons name="people-outline" size={21} color={ChatColors.gold} /> : (
              <Text style={styles.headerAvatarText}>{(title[0] ?? '?').toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            <Animated.Text
              key={subtitle}
              entering={FadeIn.duration(150)}
              style={[styles.headerSubtitle, typingUsers.length > 0 && styles.typingText]}
              numberOfLines={1}
            >
              {subtitle}
            </Animated.Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? 'Close message search' : 'Search messages'}
            accessibilityState={{ expanded: searchOpen }}
            onPress={() => { setSearchOpen(value => !value); setMessageQuery(''); }}
            style={({ pressed }) => [styles.iconButton, searchOpen && styles.activeIcon, pressed && styles.iconButtonPressed]}
          >
            <Ionicons name={searchOpen ? 'close' : 'search-outline'} size={21} color={searchOpen ? ChatColors.gold : ChatColors.textSecondary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chat safety and community rules"
            onPress={() => router.push('/chat-safety')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={ChatColors.textSecondary} />
          </Pressable>
        </View>
        {searchOpen && (
          <View style={styles.searchArea}>
            <View style={styles.searchField}>
              <Ionicons name="search-outline" size={18} color={ChatColors.muted} />
              <TextInput
                accessibilityLabel="Search this conversation"
                style={styles.searchInput}
                value={messageQuery}
                onChangeText={setMessageQuery}
                placeholder="Search this conversation"
                placeholderTextColor={ChatColors.muted}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
                maxLength={200}
              />
              {messageSearch.isDebouncing || (searching && messageSearch.isFetching && !messageSearch.isFetchingNextPage) ? (
                <ActivityIndicator accessibilityLabel="Searching messages" size="small" color={ChatColors.gold} />
              ) : !!messageQuery && (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear message search" onPress={() => setMessageQuery('')} style={styles.clearSearch}>
                  <Ionicons name="close-circle" size={18} color={ChatColors.muted} />
                </Pressable>
              )}
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.searchCaption}>
              {searching && messageSearch.data && !searchSettling
                ? `${messageSearch.messages.length}${messageSearch.hasNextPage ? '+' : ''} ${messageSearch.messages.length === 1 ? 'message' : 'messages'} found`
                : 'Search messages from the full conversation'}
            </Text>
          </View>
        )}
      </View>

      {restricted && (
        <Text accessibilityRole="alert" style={styles.restriction}>
          Messaging is restricted until {new Date(suspension.until).toLocaleString()}. {suspension.reason} Your other shop tools remain available. Contact support@paymi.co.uk to appeal.
        </Text>
      )}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        {!!connectionMessage && !initialError && (
          <View style={styles.connectionNotice}>
            <Ionicons name={!isOnline ? 'cloud-offline-outline' : 'sync-outline'} size={16} color={ChatColors.gold} />
            <Text accessibilityLiveRegion="polite" style={styles.connectionText}>{connectionMessage}</Text>
            {isOnline && backgroundError && (
              <Pressable accessibilityRole="button" accessibilityLabel="Refresh messages" onPress={() => { void displayedThread.refetch(); }} style={styles.inlineRetry}>
                <Text style={styles.retryText}>Refresh</Text>
              </Pressable>
            )}
          </View>
        )}
        {initialError ? (
          <View style={styles.errorState}>
            <View style={styles.errorIcon}>
              <Ionicons name={accessDenied ? 'lock-closed-outline' : 'cloud-offline-outline'} size={28} color={ChatColors.gold} />
            </View>
            <Text accessibilityRole="header" style={styles.errorTitle}>{accessDenied ? accessError.title : displayedError.title}</Text>
            <Text accessibilityRole="alert" style={styles.errorText}>{accessDenied ? accessError.message : displayedError.message}</Text>
            {(accessDenied ? accessError : displayedError).retryable && (
              <Pressable accessibilityRole="button" onPress={() => { void displayedThread.refetch(); }} style={styles.retryButton}>
                <Ionicons name="refresh-outline" size={17} color={ChatColors.gold} />
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            )}
          </View>
        ) : waitingForConnection ? (
          <View style={styles.errorState}>
            <View style={styles.errorIcon}><Ionicons name="cloud-offline-outline" size={28} color={ChatColors.gold} /></View>
            <Text accessibilityRole="header" style={styles.errorTitle}>Waiting for a connection</Text>
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {searching ? 'Search will resume when you’re back online.' : 'Your conversation will load when you’re back online. Your draft stays here.'}
            </Text>
          </View>
        ) : displayedThread.isPending || searchSettling ? (
          <MessageTimelineSkeleton />
        ) : (
          <MessageTimeline
            key={`${chatId}:${searching ? messageQuery.trim() : 'conversation'}`}
            messages={displayedThread.messages}
            isGroup={isGroup}
            hasOlder={displayedThread.hasNextPage}
            loadingOlder={displayedThread.isFetchingNextPage}
            onLoadOlder={loadOlder}
            loadOlderError={displayedThread.isFetchNextPageError ? 'Earlier messages couldn’t load.' : undefined}
            emptyTitle={searching ? 'No matching messages' : undefined}
            emptyDescription={searching ? 'Try a different word or phrase.' : undefined}
            onLongPress={handleLongPress}
          />
        )}

        {uploading && (
          <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut} style={styles.uploadBar}>
            <ActivityIndicator size="small" color={ChatColors.gold} />
            <Text style={styles.uploadText}>Sending image…</Text>
          </Animated.View>
        )}

        <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.inputBar}>
            <View style={styles.composerShell}>
              <Pressable
                onPress={handleAttachImage}
                accessibilityRole="button"
                accessibilityLabel="Choose a photo"
                disabled={uploading || messagingUnavailable}
                style={({ pressed }) => [styles.attachButton, (uploading || messagingUnavailable) && styles.attachmentDisabled, pressed && styles.iconButtonPressed]}
              >
                <Ionicons name="image-outline" size={22} color={ChatColors.textSecondary} />
              </Pressable>
              <TextInput
                accessibilityLabel="Message"
                style={styles.input}
                editable={!messagingUnavailable}
                value={draft}
                onChangeText={handleChangeText}
                placeholder="Write a message…"
                placeholderTextColor={ChatColors.muted}
                multiline
                maxLength={2000}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open chat camera"
                onPress={() => { if (attachmentBusy.current) return; Keyboard.dismiss(); photoSession.current = null; setCameraOpen(true); }}
                disabled={uploading || messagingUnavailable}
                style={({ pressed }) => [styles.attachButton, (uploading || messagingUnavailable) && styles.attachmentDisabled, pressed && styles.iconButtonPressed]}
              >
                <Ionicons name="camera-outline" size={23} color={ChatColors.textSecondary} />
              </Pressable>
            </View>
            <Pressable
              onPress={handleSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!draft.trim() || messagingUnavailable}
              style={({ pressed }) => [styles.sendButton, (!draft.trim() || messagingUnavailable) && styles.sendButtonDisabled, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="arrow-up" size={23} color={!draft.trim() || messagingUnavailable ? ChatColors.muted : '#FFFFFF'} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      {cameraOpen && isFocused && !messagingUnavailable && <ChatCamera key={chatId} onClose={closeCamera} onSend={handleCameraPhoto} />}
      <BottomSheet visible={menuActions.length > 0} onClose={() => setMenuActions([])} scrollable>
        <Text accessibilityRole="header" style={[styles.headerTitle, { padding: Spacing.md }]}>Message actions</Text>
        {menuActions.map(action => (
          <Pressable key={action.text} accessibilityRole="button" style={styles.menuAction} onPress={() => { setMenuActions([]); action.onPress?.(); }}>
            <Text style={[styles.menuActionText, action.style === 'destructive' && { color: ChatColors.danger }]}>{action.text}</Text>
          </Pressable>
        ))}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: ChatColors.canvas },
  flex: { flex: 1, minHeight: 0 },
  headerSurface: { backgroundColor: ChatColors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ChatColors.border },
  header: { width: '100%', maxWidth: 1000, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 10 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconButtonPressed: { backgroundColor: ChatColors.surfaceMuted },
  activeIcon: { backgroundColor: ChatColors.goldSoft },
  headerAvatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: ChatColors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { ...Typography.bodyBold, fontSize: 18, color: ChatColors.gold },
  headerInfo: { flex: 1, minWidth: 0, gap: 2, paddingLeft: 7 },
  headerTitle: { ...Typography.bodyBold, fontSize: 16, letterSpacing: -0.2, color: ChatColors.text },
  headerSubtitle: { ...Typography.caption, color: ChatColors.textSecondary },
  typingText: { color: ChatColors.gold, fontWeight: '600' },
  searchArea: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  searchField: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, paddingHorizontal: 12, backgroundColor: ChatColors.surfaceMuted },
  searchInput: { flex: 1, minWidth: 0, minHeight: 44, ...Typography.bodySmall, color: ChatColors.text },
  clearSearch: { minWidth: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  searchCaption: { ...Typography.caption, fontSize: 11, color: ChatColors.textSecondary, paddingHorizontal: 2 },
  restriction: { ...Typography.bodySmall, padding: Spacing.md, color: ChatColors.danger, backgroundColor: '#FCEEEA' },
  connectionNotice: { width: '100%', maxWidth: 960, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 7 },
  connectionText: { flex: 1, ...Typography.caption, color: ChatColors.textSecondary },
  inlineRetry: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 5 },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: ChatColors.goldSoft, marginBottom: 4 },
  errorTitle: { ...Typography.bodyBold, fontSize: 18, color: ChatColors.text, textAlign: 'center' },
  errorText: { ...Typography.bodySmall, maxWidth: 320, color: ChatColors.textSecondary, textAlign: 'center' },
  retryButton: { minHeight: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: ChatColors.goldSoft, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  retryText: { ...Typography.label, color: ChatColors.gold },
  attachmentDisabled: { opacity: 0.4 },
  uploadBar: { width: '100%', maxWidth: 960, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 6 },
  uploadText: { ...Typography.caption, color: ChatColors.textSecondary },
  composerArea: { paddingTop: 8, paddingHorizontal: 12, backgroundColor: ChatColors.canvas },
  inputBar: { width: '100%', maxWidth: 936, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerShell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-end', minHeight: 50, padding: 2, borderRadius: 25, borderWidth: 1, borderColor: ChatColors.border, backgroundColor: ChatColors.surface },
  attachButton: { width: 42, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, minHeight: 44, maxHeight: 130, paddingTop: 11, paddingBottom: 10, paddingHorizontal: 2, ...Typography.body, fontSize: 15, lineHeight: 22, color: ChatColors.text },
  sendButton: { width: 48, height: 48, marginBottom: 1, borderRadius: 24, backgroundColor: ChatColors.gold, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: ChatColors.surfaceMuted },
  menuAction: { padding: Spacing.md, minHeight: 48 },
  menuActionText: { ...Typography.body, color: ChatColors.text },
});
