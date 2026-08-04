import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { chatKeys } from './keys';
import type { ChatMessage, ChatSummary, ChatThreadPage } from './types';

export type ThreadData = InfiniteData<ChatThreadPage, number>;

/** Append (or replace) a message in the newest page of a thread cache. */
export function upsertThreadMessage(
  queryClient: QueryClient,
  chatId: string,
  message: ChatMessage,
  replaceId?: string,
) {
  queryClient.setQueryData<ThreadData>(chatKeys.thread(chatId), (data) => {
    if (!data || data.pages.length === 0) return data;
    const pages = data.pages.map((page, index) => {
      if (index !== 0) return page;
      const withoutDupes = page.messages.filter(
        (m) => m.id !== message.id && (replaceId ? m.id !== replaceId : true),
      );
      return { ...page, messages: [...withoutDupes, message] };
    });
    return { ...data, pages };
  });
}

/** Remove a message from a cached thread (server-side deletions). */
export function removeThreadMessage(queryClient: QueryClient, chatId: string, messageId: string) {
  queryClient.setQueryData<ThreadData>(chatKeys.thread(chatId), (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        messages: page.messages.filter((m) => m.id !== messageId),
      })),
    };
  });
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
      return patch(chat);
    });
    // Most recent conversation first.
    return next.sort(
      (a, b) =>
        new Date(b.lastMessageTime ?? 0).getTime() - new Date(a.lastMessageTime ?? 0).getTime(),
    );
  });
  return found;
}
