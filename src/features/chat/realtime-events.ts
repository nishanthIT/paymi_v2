import type { QueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { applyMessageReceipt, patchChatSummary, upsertThreadMessage, type ThreadData } from './cache';
import { chatKeys } from './keys';
import type { ChatMessage, MessageReceiptEvent } from './types';
import type { DirectPerson } from './direct';

let focusedThread: string | null = null;
export const getFocusedChat = () => focusedThread;
export function focusChat(chatId: string) {
  focusedThread = chatId;
  return () => { if (focusedThread === chatId) focusedThread = null; };
}

/** One subscriber for all app routes, including directly opened conversation links. */
export function subscribeChatMessages(socket: Pick<Socket, 'on' | 'off' | 'emit'>, queryClient: QueryClient, options: {
  actor: DirectPerson;
  isForeground: () => boolean;
  notify: (message: ChatMessage) => void;
}) {
  const seen = new Set<string>();
  const incoming = (message: ChatMessage) => {
    const chatId = message.chatId;
    if (!chatId || !message.id) return;
    const own = message.senderId === options.actor.userId && message.senderType === options.actor.userType;
    const alreadyLoaded = queryClient.getQueryData<ThreadData>(chatKeys.thread(chatId))?.pages.some(page => page.messages.some(item => item.id === message.id));
    upsertThreadMessage(queryClient, chatId, { ...message, isOwnMessage: own });
    // Delivery is distinct from reading; an unopened conversation is still delivered to this device.
    if (!own) socket.emit('message_delivered', { chatId, messageIds: [message.id] });
    if (seen.has(message.id)) return;
    seen.add(message.id);
    if (seen.size > 2000) seen.delete(seen.values().next().value!);
    const viewing = options.isForeground() && getFocusedChat() === chatId;
    const patched = patchChatSummary(queryClient, chatId, chat => {
      const alreadyCounted = alreadyLoaded || (!!chat.lastMessageTime && Date.parse(message.timestamp) < Date.parse(chat.lastMessageTime));
      return { ...chat,
        lastMessage: message.messageType === 'TEXT' ? message.content : '📎 Attachment', lastMessageTime: message.timestamp,
        unreadCount: (chat.unreadCount ?? 0) + (own || viewing || alreadyCounted ? 0 : 1),
      };
    });
    if (!patched) void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    void queryClient.invalidateQueries({ queryKey: chatKeys.searches });
    void queryClient.invalidateQueries({ queryKey: chatKeys.messageSearches });
    // Replayed old messages refresh state silently instead of sounding like new activity.
    const recent = Math.abs(Date.now() - Date.parse(message.timestamp)) < 60000;
    if (!own && !viewing && !alreadyLoaded && recent && options.isForeground()) options.notify(message);
  };
  const receipt = (event: MessageReceiptEvent) => {
    applyMessageReceipt(queryClient, event);
    if (event.userId === options.actor.userId && event.userType === options.actor.userType && event.readAt) {
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    }
  };
  socket.on('message_received', incoming);
  socket.on('message_read', receipt);
  socket.on('message_delivered', receipt);
  return () => {
    socket.off('message_received', incoming);
    socket.off('message_read', receipt);
    socket.off('message_delivered', receipt);
  };
}
