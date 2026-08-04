import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

import { createChat, fetchChats, fetchChatUsers } from '../api';
import { patchChatSummary, removeThreadMessage, upsertThreadMessage } from '../cache';
import { chatKeys } from '../keys';
import { disconnectChatSocket, getChatSocket } from '../socket';
import type { ChatMessage, ChatSummary, ChatType, ChatUserType } from '../types';

/** Conversation list (served instantly from cache, refreshed silently). */
export function useChats(enabled = true) {
  return useQuery({
    queryKey: chatKeys.all,
    queryFn: fetchChats,
    enabled,
    staleTime: 15 * 1000,
  });
}

/** Total unread across all conversations — used for the tab badge. */
export function useUnreadCount() {
  const { data } = useChats();
  return (data ?? []).reduce((sum, chat) => sum + (chat.unreadCount ?? 0), 0);
}

/**
 * Global realtime subscription. Mount once (tabs layout): keeps the
 * conversation list, unread badge and any open thread caches live.
 */
export function useChatRealtime() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectChatSocket();
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const socket = await getChatSocket();
      if (!socket || cancelled) return;

      const onMessage = (message: ChatMessage) => {
        const chatId = message.chatId;
        if (!chatId) return;
        upsertThreadMessage(queryClient, chatId, message);
        const patched = patchChatSummary(queryClient, chatId, (chat) => ({
          ...chat,
          lastMessage: message.messageType === 'TEXT' ? message.content : '📎 Attachment',
          lastMessageTime: message.timestamp,
          unreadCount: (chat.unreadCount ?? 0) + 1,
        }));
        if (!patched) {
          queryClient.invalidateQueries({ queryKey: chatKeys.all });
        }
      };
      const onNewChat = () => queryClient.invalidateQueries({ queryKey: chatKeys.all });
      const onChatDeleted = ({ chatId }: { chatId: string }) => {
        queryClient.removeQueries({ queryKey: chatKeys.thread(chatId) });
        queryClient.invalidateQueries({ queryKey: chatKeys.all });
      };
      const onMessageDeleted = ({ messageId, chatId }: { messageId: string; chatId: string }) => {
        removeThreadMessage(queryClient, chatId, messageId);
      };

      socket.on('message_received', onMessage);
      socket.on('new_chat_created', onNewChat);
      socket.on('chat_deleted', onChatDeleted);
      socket.on('message_deleted', onMessageDeleted);

      cleanup = () => {
        socket.off('message_received', onMessage);
        socket.off('new_chat_created', onNewChat);
        socket.off('chat_deleted', onChatDeleted);
        socket.off('message_deleted', onMessageDeleted);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [isAuthenticated, queryClient]);
}

/** Debounced user directory search for starting new chats. */
export function useChatUserSearch(rawQuery: string, enabled = true) {
  const debounced = useDebouncedValue(rawQuery.trim(), 300);
  return {
    ...useQuery({
      queryKey: chatKeys.users(debounced),
      queryFn: () => fetchChatUsers(debounced || undefined),
      enabled,
      staleTime: 60 * 1000,
      placeholderData: keepPreviousData,
    }),
    isDebouncing: rawQuery.trim() !== debounced,
  };
}

/** Start (or reuse) a chat, then refresh the conversation list. */
export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation<
    ChatSummary,
    Error,
    { type: ChatType; participantIds: { userId: number; userType: ChatUserType }[]; name?: string }
  >({
    mutationFn: createChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.all }),
  });
}
