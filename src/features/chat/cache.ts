import { conversationActivity } from './dates';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { chatKeys } from './keys';
import type { ChatMessage, ChatSummary, ChatThreadPage, MessageReceiptEvent } from './types';
import type { ChatPageParam } from './history';
import type { ChatError } from './errors';

export type ThreadData = InfiniteData<ChatThreadPage, ChatPageParam>;

/** A directory denial applies to the selected shop, including cached searches. */
export function clearDeniedChatDirectory(queryClient: QueryClient, error: unknown) {
  const status = (error as ChatError | null)?.status;
  if (status !== 401 && status !== 403) return;
  for (const queryKey of [chatKeys.all, chatKeys.searches, chatKeys.directory]) {
    queryClient.setQueriesData({ queryKey }, []);
  }
  queryClient.removeQueries({ queryKey: chatKeys.messageSearches });
  void queryClient.resetQueries({ queryKey: chatKeys.threads });
}

/** Append (or replace) a message in the newest page of a thread cache. */
export function upsertThreadMessage(
  queryClient: QueryClient,
  chatId: string,
  message: ChatMessage,
  replaceId?: string,
) {
  queryClient.setQueryData<ThreadData>(chatKeys.thread(chatId), (data) => {
    if (!data || data.pages.length === 0) return data;
    const previous = data.pages.flatMap(page => page.messages).find(item => item.id === message.id);
    // A late send response/socket replay must not turn an already-read tick back into "sent".
    const merged = previous ? { ...message,
      readBy: [...new Map([...(previous.readBy ?? []), ...(message.readBy ?? [])].map(receipt => [`${receipt.userType}:${receipt.userId}`, receipt])).values()],
      deliveredTo: [...new Map([...(previous.deliveredTo ?? []), ...(message.deliveredTo ?? [])].map(receipt => [`${receipt.userType}:${receipt.userId}`, receipt])).values()],
    } : message;
    const pages = data.pages.map((page, index) => {
      const withoutDupes = page.messages.filter(
        (m) => m.id !== message.id && (replaceId ? m.id !== replaceId : true) &&
          !(message.clientMessageId && m.clientMessageId === message.clientMessageId),
      );
      return { ...page, messages: index === 0 ? [...withoutDupes, merged].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)) : withoutDupes };
    });
    return { ...data, pages };
  });
}

/** Remove a message from a cached thread (server-side deletions). */
export function removeThreadMessage(queryClient: QueryClient, chatId: string, messageId: string) {
  const remove = (data: ThreadData | undefined) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        messages: page.messages.filter((m) => m.id !== messageId),
      })),
    };
  };
  queryClient.setQueryData<ThreadData>(chatKeys.thread(chatId), remove);
  queryClient.setQueriesData<ThreadData>({ queryKey: [...chatKeys.messageSearches, chatId] }, remove);
}

/** Update ticks in both live history and saved searches without another round trip. */
export function applyMessageReceipt(queryClient: QueryClient, event: MessageReceiptEvent) {
  if (!event.chatId || !Array.isArray(event.messageIds) || !event.userId || !event.userType || !(event.readAt || event.deliveredAt)) return;
  const ids = new Set(event.messageIds);
  const patch = (data: ThreadData | undefined) => data && ({ ...data, pages: data.pages.map(page => ({
    ...page,
    messages: page.messages.map(message => {
      if (!ids.has(message.id) || (message.senderId === event.userId && message.senderType === event.userType)) return message;
      const otherUser = (receipt: { userId: number; userType: string }) => receipt.userId !== event.userId || receipt.userType !== event.userType;
      return { ...message,
        ...(event.readAt ? { readBy: [...(message.readBy ?? []).filter(otherUser), { userId: event.userId, userType: event.userType, readAt: event.readAt }] } : {}),
        ...(event.deliveredAt ? { deliveredTo: [...(message.deliveredTo ?? []).filter(otherUser), { userId: event.userId, userType: event.userType, deliveredAt: event.deliveredAt }] } : {}),
      };
    }),
  })) });
  queryClient.setQueryData<ThreadData>(chatKeys.thread(event.chatId), patch);
  queryClient.setQueriesData<ThreadData>({ queryKey: [...chatKeys.messageSearches, event.chatId] }, patch);
}

/** Retention events immediately remove expired cached history, preserving local unsent drafts. */
export function removeExpiredMessages(queryClient: QueryClient, cutoff: string, chatIds?: string[]) {
  const before = Date.parse(cutoff);
  if (!Number.isFinite(before)) return;
  const patch = (data: ThreadData | undefined) => data && ({ ...data, pages: data.pages.map(page => ({ ...page,
    messages: page.messages.filter(message => message.pending || message.failed || Date.parse(message.timestamp) >= before),
  })) });
  const affected = (query: { queryKey: readonly unknown[] }) => !chatIds || chatIds.includes(String(query.queryKey[1]));
  queryClient.setQueriesData<ThreadData>({ queryKey: chatKeys.threads, predicate: affected }, patch);
  queryClient.setQueriesData<ThreadData>({ queryKey: chatKeys.messageSearches, predicate: affected }, patch);
}

/** Patch the conversation list preview after a new message. */
export function patchChatSummary(
  queryClient: QueryClient,
  chatId: string,
  patch: (chat: ChatSummary) => ChatSummary,
): boolean {
  let found = false;
  queryClient.setQueryData<ChatSummary[]>(chatKeys.all, (chats) => {
    if (!chats) return chats;
    const next = chats.map((chat) => {
      if (chat.id !== chatId) return chat;
      found = true;
      const updated = patch(chat);
      // Late socket deliveries can update unread counts, but must not replace a newer preview.
      if (conversationActivity(updated) < conversationActivity(chat)) {
        return { ...updated, lastMessage: chat.lastMessage, lastMessageTime: chat.lastMessageTime, lastActivityAt: chat.lastActivityAt };
      }
      return updated;
    });
    // Most recent conversation first.
    return next.sort(
      (a, b) =>
        conversationActivity(b) - conversationActivity(a),
    );
  });
  return found;
}
