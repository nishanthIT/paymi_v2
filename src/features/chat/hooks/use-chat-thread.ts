import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

import {
  MESSAGES_PAGE_SIZE,
  deleteChatMessage,
  fetchChatPage,
  markMessagesRead,
  sendChatMessage,
} from '../api';
import {
  applyMessageReceipt,
  patchChatSummary,
  removeThreadMessage,
  upsertThreadMessage,
  type ThreadData,
} from '../cache';
import { chatKeys } from '../keys';
import { getChatErrorState, retryChatQuery } from '../errors';
import { flattenChatMessages, nextChatPage, preserveUnsentMessages, type ChatPageParam } from '../history';
import {
  emitTypingStart,
  emitTypingStop,
  getChatSocket,
  joinChatRoom,
  leaveChatRoom,
} from '../socket';
import type { ChatMessage, ChatParticipant, SendMessageInput } from '../types';
import { focusChat } from '../realtime-events';

/**
 * Paginated message thread. Page 1 is the newest slice; the flattened list is
 * returned newest-first, ready for an inverted FlatList.
 */
export function useChatThread(chatId: string) {
  const { isAuthenticated, activeSupermarket } = useAuth();
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: chatKeys.thread(chatId),
    queryFn: async ({ pageParam, signal }) => {
      const page = await fetchChatPage(chatId, typeof pageParam === 'number' ? pageParam : 1, { before: typeof pageParam === 'string' ? pageParam : undefined, signal });
      if (pageParam !== 1) return page;
      return preserveUnsentMessages(queryClient.getQueryData(chatKeys.thread(chatId)), { pages: [page], pageParams: [1] }).pages[0];
    },
    initialPageParam: 1 as ChatPageParam,
    getNextPageParam: (lastPage, allPages) => nextChatPage(lastPage, allPages, MESSAGES_PAGE_SIZE),
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
    retry: retryChatQuery,
    enabled: !!chatId && isAuthenticated && !!activeSupermarket,
  });

  const meta = query.data?.pages[0];

  // Backend pages are oldest-first; invert each page and order pages
  // newest-slice-first so the inverted list reads correctly.
  const messages = useMemo(() => flattenChatMessages(query.data), [query.data]);

  return {
    ...query,
    messages,
    chatName: meta?.name,
    chatType: meta?.type,
    participants: (meta?.participants ?? []) as ChatParticipant[],
  };
}

/** Searches all retained server history; search pages never replace the live timeline. */
export function useChatMessageSearch(chatId: string, rawQuery: string, enabled = true) {
  const { isAuthenticated, activeSupermarket } = useAuth();
  const queryClient = useQueryClient();
  const debounced = useDebouncedValue(rawQuery.trim(), 300);
  const query = useInfiniteQuery({
    queryKey: chatKeys.messageSearch(chatId, debounced),
    queryFn: ({ pageParam, signal }) => fetchChatPage(chatId, typeof pageParam === 'number' ? pageParam : 1, { before: typeof pageParam === 'string' ? pageParam : undefined, search: debounced, signal }),
    initialPageParam: 1 as ChatPageParam,
    getNextPageParam: (lastPage, allPages) => nextChatPage(lastPage, allPages, MESSAGES_PAGE_SIZE),
    enabled: enabled && !!chatId && !!debounced && isAuthenticated && !!activeSupermarket,
    staleTime: 15 * 1000,
    retry: retryChatQuery,
  });
  useEffect(() => {
    if (query.error && getChatErrorState(query.error).accessDenied) {
      void queryClient.resetQueries({ queryKey: chatKeys.thread(chatId) });
    }
  }, [query.error, chatId, queryClient]);
  const messages = useMemo(() => flattenChatMessages(query.data), [query.data]);
  return { ...query, messages, isDebouncing: rawQuery.trim() !== debounced };
}

/** Optimistic send with rollback-to-failed state. */
export function useSendMessage(chatId: string, { retainFailedMessage = true } = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    // The camera retains its own retryable preview. Do not leave that modal
    // waiting on an offline-paused mutation that prevents closing or retaking.
    networkMode: retainFailedMessage ? 'online' : 'always',
    mutationFn: (input: Omit<SendMessageInput, 'chatId'>) =>
      sendChatMessage({ chatId, ...input }),
    onMutate: async (input) => {
      // Mutation variables also survive an offline pause and are reused on retry.
      input.clientMessageId ??= `client-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      await queryClient.cancelQueries({ queryKey: chatKeys.thread(chatId) });
      const optimisticId = `pending-${input.clientMessageId}`;
      const optimistic: ChatMessage = {
        id: optimisticId,
        clientMessageId: input.clientMessageId,
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
        upsertThreadMessage(queryClient, chatId, { ...serverMessage, isOwnMessage: true }, context?.optimisticId);
      }
      // A retried photo may already exist on the server and emits no new socket
      // event. Restore its real activity time instead of the optimistic preview.
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      if (!retainFailedMessage) {
        removeThreadMessage(queryClient, chatId, context.optimisticId);
        void queryClient.invalidateQueries({ queryKey: chatKeys.all });
        return;
      }
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
    // Unsent optimistic messages have no server record to delete.
    mutationFn: (messageId: string) => messageId.startsWith('pending-') ? Promise.resolve() : deleteChatMessage(messageId),
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
  const isFocused = useIsFocused();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isFocused) return focusChat(chatId);
  }, [chatId, isFocused]);

  // History fetched after a reconnect is delivered too, even without a socket replay.
  useEffect(() => {
    if (!isFocused) return;
    const unreadDelivery = messages.filter(message => !message.isOwnMessage && !message.pending && !message.failed &&
      !(message.deliveredTo ?? []).some(receipt => receipt.userId === Number(user?.id) && receipt.userType === user?.userType));
    if (!unreadDelivery.length) return;
    let cancelled = false;
    void getChatSocket().then(socket => {
      if (socket?.connected && !cancelled) {
        for (let start = 0; start < unreadDelivery.length; start += 500) {
          socket.emit('message_delivered', { chatId, messageIds: unreadDelivery.slice(start, start + 500).map(message => message.id) });
        }
      }
    });
    return () => { cancelled = true; };
  }, [messages, chatId, isFocused, user?.id, user?.userType]);

  useEffect(() => {
    if (!isFocused || !appActive) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const socket = await getChatSocket();
      if (!socket || cancelled) return;
      joinChatRoom(chatId);

      const onTyping = (info: { id?: number; userId?: number; name?: string; chatId?: string }) => {
        if (info.chatId !== chatId) return;
        const name = info?.name ?? 'Someone';
        setTypingUsers((current) => (current.includes(name) ? current : [...current, name]));
      };
      const onStopTyping = (info: { name?: string; chatId?: string }) => {
        if (info.chatId !== chatId) return;
        setTypingUsers((current) => current.filter((n) => n !== (info?.name ?? 'Someone')));
      };
      const refresh = () => {
        joinChatRoom(chatId);
        void queryClient.invalidateQueries({ queryKey: chatKeys.thread(chatId) });
      };
      const onMessage = (message: ChatMessage) => {
        if (message.chatId !== chatId) return;
        upsertThreadMessage(queryClient, chatId, { ...message, isOwnMessage: message.senderId === Number(user?.id) && message.senderType === user?.userType });
        void queryClient.invalidateQueries({ queryKey: [...chatKeys.messageSearches, chatId] });
      };
      const onDeleted = ({ messageId, chatId: removedChat }: { messageId: string; chatId: string }) => {
        if (removedChat === chatId) removeThreadMessage(queryClient, chatId, messageId);
      };
      const onParticipantsChanged = ({ chatId: changedChat }: { chatId: string }) => {
        if (changedChat === chatId) refresh();
      };
      const onChatsChanged = ({ chatId: changedChat, chatIds, reason }: { chatId?: string; chatIds?: string[]; reason?: string } = {}) => {
        if (reason === 'message' || reason === 'message_delivered' || reason === 'read' ||
          (changedChat && changedChat !== chatId) || (chatIds && !chatIds.includes(chatId))) return;
        refresh();
      };
      const onChatDeleted = ({ chatId: deleted }: { chatId: string }) => {
        if (deleted !== chatId) return;
        void queryClient.resetQueries({ queryKey: chatKeys.thread(chatId) });
        queryClient.removeQueries({ queryKey: [...chatKeys.messageSearches, chatId] });
      };
      // Deep links can mount a thread without the tabs' global listener. Rejoin and
      // refetch after reconnect so missed moderation events cannot leave stale content.
      const onJoinDenied = ({ chatId: denied }: { chatId: string }) => {
        if (denied !== chatId) return;
        setTypingUsers([]);
        void queryClient.resetQueries({ queryKey: chatKeys.thread(chatId) });
        queryClient.removeQueries({ queryKey: [...chatKeys.messageSearches, chatId] });
      };
      socket.on('chat_join_denied', onJoinDenied);
      socket.on('connect', refresh);
      socket.on('message_received', onMessage);
      socket.on('message_deleted', onDeleted);
      socket.on('chat_deleted', onChatDeleted);
      socket.on('chats_changed', onChatsChanged);
      socket.on('chat_participants_changed', onParticipantsChanged);
      socket.on('user_typing', onTyping);
      socket.on('user_stopped_typing', onStopTyping);
      const appState = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          refresh();
          void getChatSocket();
        }
      });

      cleanup = () => {
        appState.remove();
        socket.off('chat_join_denied', onJoinDenied);
        socket.off('connect', refresh);
        socket.off('message_received', onMessage);
        socket.off('message_deleted', onDeleted);
        socket.off('chat_deleted', onChatDeleted);
        socket.off('chats_changed', onChatsChanged);
        socket.off('chat_participants_changed', onParticipantsChanged);
        socket.off('user_typing', onTyping);
        socket.off('user_stopped_typing', onStopTyping);
        leaveChatRoom(chatId);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      setTypingUsers([]);
    };
  }, [chatId, queryClient, user?.id, user?.userType, isFocused, appActive]);

  // Mark unread incoming messages as read whenever new ones arrive.
  const markedRef = useRef<Set<string>>(new Set());
  const pendingReadRef = useRef<Set<string>>(new Set());
  const [readAttempt, setReadAttempt] = useState(0);
  useEffect(() => {
    if (!isFocused || !appActive) return;
    const myId = Number(user?.id ?? 0);
    const pendingReads = pendingReadRef.current;
    const unread = messages.filter(
      (m) =>
        !m.isOwnMessage &&
        !m.pending &&
        !markedRef.current.has(m.id) &&
        !pendingReads.has(m.id) &&
        !(m.readBy ?? []).some((r) => Number(r.userId) === myId && r.userType === user?.userType),
    ).slice(0, 500);
    if (unread.length === 0) return;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    unread.forEach((m) => pendingReads.add(m.id));
    markMessagesRead(unread.map((m) => m.id)).then((saved) => {
      unread.forEach((m) => pendingReads.delete(m.id));
      if (disposed) return;
      if (saved === false) {
        retryTimer = setTimeout(() => setReadAttempt(value => value + 1), Math.min(30000, 2000 * 2 ** Math.min(readAttempt, 4)));
        return;
      }
      unread.forEach((m) => markedRef.current.add(m.id));
      applyMessageReceipt(queryClient, { chatId, messageIds: unread.map(message => message.id), userId: myId,
        userType: user?.userType as ChatMessage['senderType'], readAt: new Date().toISOString() });
      // The server may still have unread messages on older, unloaded pages.
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    });
    return () => { disposed = true; clearTimeout(retryTimer); unread.forEach(m => pendingReads.delete(m.id)); };
  }, [messages, chatId, queryClient, user?.id, user?.userType, isFocused, appActive, readAttempt]);

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
