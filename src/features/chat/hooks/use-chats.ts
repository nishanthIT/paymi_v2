import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useToast } from '@/components/ui/toast';

import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getSupermarketScope } from '@/features/supermarkets/scope';

import { createChat, fetchChats, fetchChatUsers } from '../api';
import { clearDeniedChatDirectory, removeThreadMessage } from '../cache';
import { chatKeys } from '../keys';
import { retryChatQuery } from '../errors';
import { refreshChatDirectory, subscribeChatRefresh } from '../realtime-refresh';
import { disconnectChatSocket, getChatSocket } from '../socket';
import type { ChatSummary, ChatType, ChatUserType } from '../types';
import { primeDirectChat, resolveDirectChat } from '../direct';
import { subscribeChatMessages } from '../realtime-events';

/** Conversation list (served instantly from cache, refreshed silently). */
export function useChats(enabled = true) {
  const { isAuthenticated, activeSupermarket } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: chatKeys.all,
    queryFn: ({ signal }) => fetchChats(undefined, signal).catch(error => {
      clearDeniedChatDirectory(queryClient, error); throw error;
    }),
    enabled: enabled && isAuthenticated && !!activeSupermarket,
    staleTime: 15 * 1000,
    retry: retryChatQuery,
    // Recover missed messages even when a proxy prevents Socket.IO from connecting.
    refetchInterval: 30 * 1000,
  });
}

/** Search the authorized server history, not just the latest preview. */
export function useChatSearch(rawQuery: string, enabled = true) {
  const { isAuthenticated, activeSupermarket } = useAuth();
  const queryClient = useQueryClient();
  const debounced = useDebouncedValue(rawQuery.trim(), 300);
  return {
    ...useQuery({
      queryKey: chatKeys.search(debounced),
      queryFn: ({ signal }) => fetchChats(debounced, signal).catch(error => {
        clearDeniedChatDirectory(queryClient, error); throw error;
      }),
      enabled: enabled && isAuthenticated && !!activeSupermarket && !!debounced,
      staleTime: 15 * 1000,
      retry: retryChatQuery,
    }),
    isDebouncing: rawQuery.trim() !== debounced,
  };
}

/** Total unread across all conversations — used for the tab badge. */
export function useUnreadCount() {
  const { data } = useChats();
  return (data ?? []).reduce((sum, chat) => sum + (chat.unreadCount ?? 0), 0);
}

/**
 * Global realtime subscription. Mount once (app layout): keeps the
 * conversation list, unread badge and any open thread caches live.
 */
export function useChatRealtime() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();
  const { isAuthenticated, user, activeSupermarket } = useAuth();
  const shopId = activeSupermarket?.id;

  useEffect(() => {
    if (!isAuthenticated || !shopId) {
      disconnectChatSocket();
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;
    let lastHapticAt = 0;

    (async () => {
      const socket = await getChatSocket();
      if (!socket || cancelled) return;

      const stopMessages = subscribeChatMessages(socket, queryClient, {
        actor: { userId: Number(user?.id), userType: user?.userType as ChatUserType },
        isForeground: () => AppState.currentState === 'active',
        notify: message => {
          const summary = queryClient.getQueryData<ChatSummary[]>(chatKeys.all)?.find(chat => chat.id === message.chatId);
          const preview = message.messageType === 'TEXT' ? message.content.replace(/\s+/g, ' ').slice(0, 100)
            : message.messageType === 'IMAGE' ? 'Sent a photo' : message.messageType === 'LIST_SHARE' ? 'Shared a list' : 'Sent a file';
          showToast(`${message.senderName || 'New message'}: ${preview}`, 'info', {
            durationMs: 4500,
            onPress: () => router.push({ pathname: '/(app)/chat/[id]', params: { id: message.chatId!, name: summary?.name ?? message.senderName, type: summary?.type ?? 'PERSONAL' } }),
          });
          if (Platform.OS !== 'web' && Date.now() - lastHapticAt > 1500) {
            lastHapticAt = Date.now();
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        },
      });
      const stopRefresh = subscribeChatRefresh(socket, queryClient);
      const onChatDeleted = ({ chatId }: { chatId: string }) => {
        queryClient.removeQueries({ queryKey: chatKeys.thread(chatId) });
        queryClient.invalidateQueries({ queryKey: chatKeys.all });
      };
      const onMessageDeleted = ({ messageId, chatId }: { messageId: string; chatId: string }) => {
        removeThreadMessage(queryClient, chatId, messageId);
        queryClient.invalidateQueries({ queryKey: chatKeys.all });
        queryClient.invalidateQueries({ queryKey: chatKeys.searches });
      };

      const onSuspended = () => queryClient.invalidateQueries({ queryKey: ['chat-safety'] });
      socket.on('chat_suspended', onSuspended);
      socket.on('chat_deleted', onChatDeleted);
      socket.on('message_deleted', onMessageDeleted);

      cleanup = () => {
        stopRefresh();
        stopMessages();
        socket.off('chat_suspended', onSuspended);
        socket.off('chat_deleted', onChatDeleted);
        socket.off('message_deleted', onMessageDeleted);
      };
    })();

    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refreshChatDirectory(queryClient);
      void queryClient.invalidateQueries({ queryKey: chatKeys.threads });
      void getChatSocket();
    });

    return () => {
      cancelled = true;
      appState.remove();
      cleanup?.();
    };
  }, [isAuthenticated, queryClient, user?.id, user?.userType, shopId, router, showToast]);
}

/** Debounced user directory search for starting new chats. */
export function useChatUserSearch(rawQuery: string, enabled = true) {
  const { isAuthenticated, activeSupermarket } = useAuth();
  const queryClient = useQueryClient();
  const debounced = useDebouncedValue(rawQuery.trim(), 300);
  return {
    ...useQuery({
      queryKey: chatKeys.users(debounced),
      queryFn: ({ signal }) => fetchChatUsers(debounced || undefined, signal).catch(error => {
        clearDeniedChatDirectory(queryClient, error); throw error;
      }),
      enabled: enabled && isAuthenticated && !!activeSupermarket,
      staleTime: 60 * 1000,
      placeholderData: keepPreviousData,
      retry: retryChatQuery,
    }),
    isDebouncing: rawQuery.trim() !== debounced,
  };
}

/** Start (or reuse) a chat, then refresh the conversation list. */
export function useCreateChat() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation<
    ChatSummary,
    Error,
    { type: ChatType; participantIds: { userId: number; userType: ChatUserType }[]; name?: string }
  >({
    networkMode: 'always',
    mutationFn: input => {
      const scope = getSupermarketScope();
      const actor = { userId: Number(user?.id), userType: user?.userType as ChatUserType };
      if (input.type === 'PERSONAL' && input.participantIds.length === 1) {
        return resolveDirectChat({ queryClient, actor, recipient: input.participantIds[0], scope,
          isCurrent: () => scope.generation === getSupermarketScope().generation,
          create: () => createChat(input) });
      }
      return createChat(input).then(chat => {
        if (scope.generation === getSupermarketScope().generation) primeDirectChat(queryClient, chat);
        return chat;
      });
    },
  });
}
