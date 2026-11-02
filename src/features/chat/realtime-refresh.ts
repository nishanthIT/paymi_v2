import type { QueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';

import { chatKeys } from './keys';
import { removeExpiredMessages } from './cache';

/** Invalidate each view of the roster, including searches cached before a staff change. */
export function refreshChatDirectory(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: chatKeys.all });
  void queryClient.invalidateQueries({ queryKey: chatKeys.directory });
  void queryClient.invalidateQueries({ queryKey: chatKeys.searches });
  void queryClient.invalidateQueries({ queryKey: chatKeys.messageSearches });
}

export function subscribeChatRefresh(socket: Pick<Socket, 'on' | 'off'>, queryClient: QueryClient) {
  const refresh = () => refreshChatDirectory(queryClient);
  const changed = ({ reason, chatId, chatIds, cutoff }: { reason?: string; chatId?: string; chatIds?: string[]; cutoff?: string } = {}) => {
    if (!reason) { refresh(); return; }
    if (reason === 'message_delivered') return;
    // Message/receipt hints do not change contact eligibility. Avoid an expensive
    // full retail-directory refresh for each keystroke-sized message.
    void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    void queryClient.invalidateQueries({ queryKey: chatKeys.searches });
    if (reason !== 'read') void queryClient.invalidateQueries({ queryKey: chatKeys.messageSearches });
    if (reason === 'retention') {
      const affected = chatIds ?? (chatId ? [chatId] : undefined);
      if (cutoff) removeExpiredMessages(queryClient, cutoff, affected);
      void queryClient.invalidateQueries({ queryKey: chatKeys.threads, predicate: query => !affected || affected.includes(String(query.queryKey[1])) });
    } else if (chatId && reason === 'deleted') {
      void queryClient.invalidateQueries({ queryKey: chatKeys.thread(chatId) });
    }
  };
  const reconnect = () => {
    refresh();
    // Events missed while offline include removals and membership changes.
    void queryClient.invalidateQueries({ queryKey: chatKeys.threads });
  };
  const participantsChanged = ({ chatId }: { chatId?: string } = {}) => {
    refresh();
    if (chatId) void queryClient.invalidateQueries({ queryKey: chatKeys.thread(chatId) });
  };
  socket.on('connect', reconnect);
  socket.on('chats_changed', changed);
  socket.on('new_chat_created', refresh);
  socket.on('chat_participants_changed', participantsChanged);
  return () => {
    socket.off('connect', reconnect);
    socket.off('chats_changed', changed);
    socket.off('new_chat_created', refresh);
    socket.off('chat_participants_changed', participantsChanged);
  };
}
