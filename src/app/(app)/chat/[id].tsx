import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';
import { uploadChatFile } from '@/features/chat/api';
import { MessageBubble } from '@/features/chat/components/message-bubble';
import {
  useChatThread,
  useDeleteMessage,
  useSendMessage,
  useThreadRealtime,
  useTypingEmitter,
} from '@/features/chat/hooks/use-chat-thread';
import type { ChatMessage } from '@/features/chat/types';

/**
 * Message thread: realtime, optimistic sends, typing indicator, read
 * receipts, image attachments and infinite history.
 */
export default function ChatThreadScreen() {
  const { id, name, type } = useLocalSearchParams<{ id: string; name?: string; type?: string }>();
  const chatId = id ?? '';
  const router = useRouter();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const thread = useChatThread(chatId);
  const send = useSendMessage(chatId);
  const deleteMessage = useDeleteMessage(chatId);
  const { typingUsers } = useThreadRealtime(chatId, thread.messages);
  const { onInputChange } = useTypingEmitter(chatId);

  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);

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
      onInputChange(text);
    },
    [onInputChange],
  );

  const handleSend = useCallback(() => {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    send.mutate(
      { content },
      {
        onError: (error: any) => {
          if (!error?.silent) showToast(error?.message ?? 'Message failed to send', 'error');
        },
      },
    );
  }, [draft, send, showToast]);

  const handleAttachImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const file = await uploadChatFile(
        asset.uri,
        asset.fileName ?? `photo-${Date.now()}.jpg`,
        asset.mimeType ?? 'image/jpeg',
      );
      send.mutate(
        {
          content: file.name,
          messageType: file.type,
          attachmentUrl: file.url,
          attachmentName: file.name,
          attachmentSize: file.size,
        },
        {
          onError: (error: any) => {
            if (!error?.silent) showToast(error?.message ?? 'Image failed to send', 'error');
          },
        },
      );
    } catch (error: any) {
      showToast(error?.message ?? 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }, [send, showToast]);

  const handleLongPress = useCallback(
    (message: ChatMessage) => {
      const actions: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
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
      if (message.failed) {
        actions.push({
          text: 'Retry send',
          onPress: () => {
            deleteMessage.mutate(message.id);
            send.mutate({
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
            deleteMessage.mutate(message.id, {
              onError: (error: any) => {
                if (!error?.silent) showToast(error?.message ?? 'Delete failed', 'error');
              },
            }),
        });
      }
      if (actions.length === 0) return;
      actions.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Message', undefined, actions);
    },
    [deleteMessage, send, showToast],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.light.text} />
        </Pressable>
        <View style={styles.headerAvatar}>
          {isGroup ? (
            <Ionicons name="people" size={18} color={Colors.light.primary} />
          ) : (
            <Text style={styles.headerAvatarText}>
              {(title[0] ?? '?').toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Animated.Text
            key={subtitle}
            entering={FadeIn.duration(150)}
            style={[styles.headerSubtitle, typingUsers.length > 0 && styles.typingText]}
            numberOfLines={1}
          >
            {subtitle}
          </Animated.Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {thread.isPending ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.light.primary} />
          </View>
        ) : (
          <FlatList
            data={thread.messages}
            keyExtractor={(item) => item.id}
            inverted
            renderItem={({ item }) => (
              <MessageBubble message={item} isGroup={isGroup} onLongPress={handleLongPress} />
            )}
            contentContainerStyle={styles.messagesContent}
            onEndReached={() => {
              if (thread.hasNextPage && !thread.isFetchingNextPage) thread.fetchNextPage();
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              thread.isFetchingNextPage ? (
                <ActivityIndicator
                  color={Colors.light.primary}
                  style={{ marginVertical: Spacing.md }}
                />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyThread}>
                <Text style={styles.emptyThreadText}>No messages yet — say hello </Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
        )}

        {uploading && (
          <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut} style={styles.uploadBar}>
            <ActivityIndicator size="small" color={Colors.light.primary} />
            <Text style={styles.uploadText}>Sending image…</Text>
          </Animated.View>
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
          <Pressable
            onPress={handleAttachImage}
            hitSlop={8}
            disabled={uploading}
            style={({ pressed }) => [styles.attachButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="image-outline" size={22} color={Colors.light.primary} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={handleChangeText}
            placeholder="Message"
            placeholderTextColor={Colors.light.textLight}
            multiline
            maxLength={2000}
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim()}
            style={({ pressed }) => [
              styles.sendButton,
              !draft.trim() && styles.sendButtonDisabled,
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
          >
            <Ionicons name="send" size={17} color="#FFFFFF" />
          </Pressable>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    backgroundColor: Colors.light.background,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    ...Typography.bodyBold,
    color: Colors.light.primary,
  },
  headerInfo: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    ...Typography.bodyBold,
    fontSize: 16,
    color: Colors.light.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  typingText: {
    color: Colors.light.primary,
    fontWeight: '700',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContent: {
    paddingVertical: Spacing.sm,
  },
  emptyThread: {
    padding: Spacing.xl,
    alignItems: 'center',
    // Counteract the inverted list so the empty state reads upright.
    transform: [{ scaleY: -1 }],
  },
  emptyThreadText: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  uploadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  uploadText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
    backgroundColor: Colors.light.background,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryLight,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: Colors.light.backgroundCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    ...Typography.body,
    fontSize: 15,
    color: Colors.light.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.light.buttonDisabledText,
    opacity: 0.5,
  },
});
