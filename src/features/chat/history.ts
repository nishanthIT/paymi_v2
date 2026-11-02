import type { InfiniteData } from '@tanstack/react-query';
import type { ChatMessage, ChatThreadPage } from './types';

export type ChatPageParam = number | string;

export function nextChatPage(lastPage: ChatThreadPage, pages: ChatThreadPage[], pageSize: number): ChatPageParam | undefined {
  if (lastPage.pagination) return lastPage.pagination.hasMore ? lastPage.pagination.nextCursor ?? undefined : undefined;
  // Keep working during a rolling backend deployment that still returns page/limit.
  return lastPage.messages.length >= pageSize ? pages.length + 1 : undefined;
}

export function flattenChatMessages(data?: InfiniteData<ChatThreadPage>): ChatMessage[] {
  const seen = new Set<string>();
  const messages: ChatMessage[] = [];
  for (const page of data?.pages ?? []) {
    for (let index = page.messages.length - 1; index >= 0; index -= 1) {
      const message = page.messages[index];
      if (!seen.has(message.id)) { seen.add(message.id); messages.push(message); }
    }
  }
  return messages.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

/** A refresh must not erase an unsent draft bubble or its retry control. */
export function preserveUnsentMessages(previous: unknown, next: InfiniteData<ChatThreadPage, ChatPageParam>) {
  const old = previous as InfiniteData<ChatThreadPage, ChatPageParam> | undefined;
  if (!old?.pages || !next.pages.length) return next;
  const incoming = next.pages.flatMap(page => page.messages);
  const ids = new Set(incoming.map(message => message.id));
  const clientIds = new Set(incoming.map(message => message.clientMessageId).filter(Boolean));
  const unsent = old.pages.flatMap(page => page.messages).filter(message =>
    (message.pending || message.failed) && !ids.has(message.id) &&
    !(message.clientMessageId && clientIds.has(message.clientMessageId)),
  );
  if (!unsent.length) return next;
  return { ...next, pages: next.pages.map((page, index) => index === 0 ? { ...page, messages: [...page.messages, ...unsent] } : page) };
}
