import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';

import {
  MESSAGES_PAGE_SIZE,
  deleteChatMessage,
  fetchChatPage,
  markMessagesRead,
  sendChatMessage,
} from '../api';
import {
  patchChatSummary,
  removeThreadMessage,
  upsertThreadMessage,
  type ThreadData,
} from '../cache';
import { chatKeys } from '../keys';
import {
  emitTypingStart,
  emitTypingStop,
  getChatSocket,
  joinChatRoom,
  leaveChatRoom,
} from '../socket';
import type { ChatMessage, ChatParticipant, SendMessageInput } from '../types';

/**
 * Paginated message thread. Page 1 is the newest slice; the flattened list is
 * returned newest-first, ready for an inverted FlatList.
 */
export function useChatThread(chatId: string) {
  const query = useInfiniteQuery({
    queryKey: chatKeys.thread(chatId),
    queryFn: ({ pageParam }) => fetchChatPage(chatId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      (lastPage?.messages?.length ?? 0) >= MESSAGES_PAGE_SIZE ? allPages.length + 1 : undefined,
    staleTime: 10 * 1000,
    enabled: !!chatId,
  });

  const meta = query.data?.pages[0];

  // Backend pages are oldest-first; invert each page and order pages
  // newest-slice-first so the inverted list reads correctly.
  const messages = useMemo<ChatMessage[]>(() => {
    if (!query.data) return [];
    const seen = new Set<string>();
    const result: ChatMessage[] = [];
    for (const page of query.data.pages) {
      for (let i = page.messages.length - 1; i >= 0; i -= 1) {
        const message = page.messages[i];
        if (!seen.has(message.id)) {
          seen.add(message.id);
          result.push(message);
        }
      }
    }
    return result;
  }, [query.data]);

  return {
    ...query,
    messages,
    chatName: meta?.name,
    chatType: meta?.type,
    participants: (meta?.participants ?? []) as ChatParticipant[],
  };
}

/** Optimistic send with rollback-to-failed state. */
export function useSendMessage(chatId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (input: Omit<SendMessageInput, 'chatId'>) =>
      sendChatMessage({ chatId, ...input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.thread(chatId) });
      const optimisticId = `pending-${Date.now()}`;
      const optimistic: ChatMessage = {
        id: optimisticId,
        chatId,
        content: input.content,
        senderId: Number(user?.id ?? 0),
        senderName: user?.name ?? 'You',
        senderType: (user?.userType as ChatMessage['senderType']) ?? 'CUSTOMER',
        messageType: input.messageType ?? 'TEXT',
        attachmentUrl: input.attachmentUrl,
        attachmentName: input.attachmentName,
        attachmentSize: input.attachmentSize,
        timestamp: new Date().toISOString(),
        isOwnMessage: true,
        pending: true,
      };
      upsertThreadMessage(queryClient, chatId, optimistic);
      patchChatSummary(queryClient, chatId, (chat) => ({
        ...chat,
        lastMessage: optimistic.messageType === 'TEXT' ? optimistic.content : '📎 Attachment',
        lastMessageTime: optimistic.timestamp,
      }));
      return { optimisticId };
    },
    onSuccess: (serverMessage, _input, context) => {
      if (serverMessage) {
        upsertThreadMessage(queryClient, chatId, serverMessage, context?.optimisticId);
      }
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData<ThreadData>(chatKeys.thread(chatId), (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) =>
              m.id === context.optimisticId ? { ...m, pending: false, failed: true } : m,
            ),
          })),
        };
      });
    },
  });
}

/** Delete own message (optimistic removal). */
export function useDeleteMessage(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => deleteChatMessage(messageId),
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.thread(chatId) });
      const previous = queryClient.getQueryData<ThreadData>(chatKeys.thread(chatId));
      removeThreadMessage(queryClient, chatId, messageId);
      return { previous };
    },
    onError: (_error, _messageId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(chatKeys.thread(chatId), context.previous);
      }
    },
  });
}

/**
 * Live wiring for an open thread: joins the socket room, tracks who is
 * typing, and marks incoming messages as read.
 */
export function useThreadRealtime(chatId: string, messages: ChatMessage[]) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const socket = await getChatSocket();
      if (!socket || cancelled) return;
      joinChatRoom(chatId);

      const onTyping = (info: { id?: number; userId?: number; name?: string }) => {
        const name = info?.name ?? 'Someone';
        setTypingUsers((current) => (current.includes(name) ? current : [...current, name]));
      };
      const onStopTyping = (info: { name?: string }) => {
        setTypingUsers((current) => current.filter((n) => n !== (info?.name ?? 'Someone')));
      };
      socket.on('user_typing', onTyping);
      socket.on('user_stopped_typing', onStopTyping);

      cleanup = () => {
        socket.off('user_typing', onTyping);
        socket.off('user_stopped_typing', onStopTyping);
        leaveChatRoom(chatId);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [chatId]);

  // Mark unread incoming messages as read whenever new ones arrive.
  const markedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const myId = Number(user?.id ?? 0);
    const unread = messages.filter(
      (m) =>
        !m.isOwnMessage &&
        !m.pending &&
        !markedRef.current.has(m.id) &&
        !(m.readBy ?? []).some((r) => Number(r.userId) === myId),
    );
    if (unread.length === 0) return;
    unread.forEach((m) => markedRef.current.add(m.id));
    markMessagesRead(unread.map((m) => m.id)).then(() => {
      patchChatSummary(queryClient, chatId, (chat) => ({ ...chat, unreadCount: 0 }));
    });
  }, [messages, chatId, queryClient, user?.id]);

  return { typingUsers };
}

/** Emits throttled typing_start / typing_stop while the user writes. */
export function useTypingEmitter(chatId: string) {
  const { user } = useAuth();
  const typingRef = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userInfo = useMemo(
    () => ({ id: Number(user?.id ?? 0), name: user?.name ?? 'Someone' }),
    [user?.id, user?.name],
  );

  const onInputChange = useCallback(
    (text: string) => {
      if (text.length > 0 && !typingRef.current) {
        typingRef.current = true;
        emitTypingStart(chatId, userInfo);
      }
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(() => {
        if (typingRef.current) {
          typingRef.current = false;
          emitTypingStop(chatId, userInfo);
        }
      }, 1800);
    },
    [chatId, userInfo],
  );

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (typingRef.current) emitTypingStop(chatId, userInfo);
    },
    [chatId, userInfo],
  );

  return { onInputChange };
}
