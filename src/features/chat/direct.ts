import type { QueryClient } from '@tanstack/react-query';

import { chatKeys } from './keys';
import type { ChatSummary, ChatUserType } from './types';

export type DirectPerson = { userId: number; userType: ChatUserType };
const identity = (person: DirectPerson) => `${person.userType}:${person.userId}`;
const pendingByClient = new WeakMap<QueryClient, Map<string, Promise<ChatSummary>>>();

/** A cached room is only a navigation shortcut; every subsequent read/send still checks the server ACL. */
export function findDirectChat(chats: ChatSummary[] | undefined, actor: DirectPerson, recipient: DirectPerson, shopId: string | null) {
  const pair = new Set([identity(actor), identity(recipient)]);
  if (pair.size !== 2 || !shopId) return undefined;
  return chats?.find(chat => chat.type === 'PERSONAL' && (chat.isCommunityChat || chat.shopId === shopId) &&
    chat.participants.length === 2 && new Set(chat.participants.map(person => `${person.userType}:${Number(person.id)}`)).size === 2 &&
    chat.participants.every(person => pair.has(identity({ userId: Number(person.id), userType: person.userType }))));
}

export function primeDirectChat(queryClient: QueryClient, chat: ChatSummary) {
  const { initialPage, ...summary } = chat;
  queryClient.setQueryData<ChatSummary[]>(chatKeys.all, chats => [summary, ...(chats ?? []).filter(item => item.id !== chat.id)]);
  if (initialPage && !queryClient.getQueryData(chatKeys.thread(chat.id))) {
    queryClient.setQueryData(chatKeys.thread(chat.id), { pages: [initialPage], pageParams: [1] });
  }
  // Do not hold navigation behind a directory refresh on a slow connection.
  void queryClient.invalidateQueries({ queryKey: chatKeys.all });
  void queryClient.invalidateQueries({ queryKey: chatKeys.searches });
}

/** Coalesce simultaneous selections, including a retry after leaving the opening screen. */
export function resolveDirectChat(options: {
  queryClient: QueryClient;
  actor: DirectPerson;
  recipient: DirectPerson;
  scope: { id: string | null; generation: number };
  isCurrent: () => boolean;
  create: () => Promise<ChatSummary>;
}): Promise<ChatSummary> {
  const { queryClient, actor, recipient, scope, isCurrent, create } = options;
  const cached = findDirectChat(queryClient.getQueryData(chatKeys.all), actor, recipient, scope.id);
  if (cached) return Promise.resolve(cached);
  let pending = pendingByClient.get(queryClient);
  if (!pending) { pending = new Map(); pendingByClient.set(queryClient, pending); }
  const key = `${scope.generation}:${scope.id}:${[identity(actor), identity(recipient)].sort().join('|')}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = Promise.resolve().then(create).then(chat => {
    if (!isCurrent()) throw Object.assign(new Error('Your shop or sign-in changed. Open the conversation again.'), { silent: true });
    primeDirectChat(queryClient, chat);
    return chat;
  }).finally(() => { pending!.delete(key); });
  pending.set(key, request);
  return request;
}
