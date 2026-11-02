import { getSupermarketScope, beginScopedWrite, endScopedWrite } from '@/features/supermarkets/scope';
import { API_CONFIG } from '@/config/api';
import api from '@/services/api';
import { secureStorage } from '@/utils/secureStorage';
import { Platform } from 'react-native';

import { createChatUploadBody } from './photo-send';
import { toChatError, type ChatError } from './errors';

import type {
  ChatSummary,
  ChatThreadPage,
  ChatType,
  ChatUserType,
  DirectoryUser,
  SendMessageInput,
  UploadedFile,
} from './types';

export const MESSAGES_PAGE_SIZE = 30;
// Chat authorization and history need several database queries. A cold/remote
// database can exceed the general 10-second API budget without being offline.
const CHAT_TIMEOUT = Math.max(API_CONFIG.TIMEOUT || 0, 60000);

function invalidResponse(): never {
  const error: ChatError = new Error('The chat service returned an incomplete response.');
  error.code = 'CHAT_INVALID_RESPONSE';
  throw error;
}

export async function fetchChats(search?: string, signal?: AbortSignal): Promise<ChatSummary[]> {
  try {
    const response = await api.get('/chat', { params: search?.trim() ? { search: search.trim() } : undefined, signal, timeout: CHAT_TIMEOUT });
    if (!Array.isArray(response.data?.chats)) invalidResponse();
    return response.data.chats;
  } catch (error: any) {
    throw toChatError(error, 'Could not load chats');
  }
}

export async function fetchChatPage(chatId: string, page: number, options: { before?: string; search?: string; signal?: AbortSignal } = {}): Promise<ChatThreadPage> {
  try {
    const response = await api.get(`/chat/${chatId}`, {
      params: { page, limit: MESSAGES_PAGE_SIZE, ...(options.before ? { before: options.before } : {}), ...(options.search?.trim() ? { search: options.search.trim() } : {}) },
      signal: options.signal,
      timeout: CHAT_TIMEOUT,
    });
    if (!response.data?.chat?.id || !Array.isArray(response.data.chat.messages)) invalidResponse();
    return response.data.chat;
  } catch (error: any) {
    throw toChatError(error, 'Could not load messages');
  }
}

export async function sendChatMessage(input: SendMessageInput) {
  try {
    const response = await api.post('/chat/message', {
      messageType: 'TEXT',
      ...input,
    }, { timeout: CHAT_TIMEOUT });
    if (!response.data?.message?.id) invalidResponse();
    return response.data.message;
  } catch (error: any) {
    throw toChatError(error, 'Message failed to send');
  }
}

export async function markMessagesRead(messageIds: string[]): Promise<boolean> {
  if (messageIds.length === 0) return true;
  try {
    await api.post('/chat/read', { messageIds }, { timeout: CHAT_TIMEOUT });
    return true;
  } catch {
    // Read receipts are best-effort — never surface an error for them.
    return false;
  }
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  try {
    await api.delete(`/chat/message/${messageId}`, { timeout: CHAT_TIMEOUT });
  } catch (error: any) {
    throw toChatError(error, 'Could not delete the message');
  }
}

export async function deleteChat(chatId: string): Promise<void> {
  try {
    await api.delete(`/chat/${chatId}`, { timeout: CHAT_TIMEOUT });
  } catch (error: any) {
    throw toChatError(error, 'Could not delete the chat');
  }
}

export async function fetchChatUsers(search?: string, signal?: AbortSignal): Promise<DirectoryUser[]> {
  try {
    const response = await api.get('/chat/users', {
      params: search ? { search } : undefined,
      signal,
      timeout: CHAT_TIMEOUT,
    });
    if (!Array.isArray(response.data?.users)) invalidResponse();
    return response.data.users;
  } catch (error: any) {
    throw toChatError(error, 'Could not load contacts');
  }
}

export async function createChat(input: {
  type: ChatType;
  participantIds: { userId: number; userType: ChatUserType }[];
  name?: string;
}): Promise<ChatSummary> {
  try {
    const response = await api.post('/chat', input, { timeout: CHAT_TIMEOUT });
    if (!response.data?.chat?.id) invalidResponse();
    return response.data.chat;
  } catch (error: any) {
    throw toChatError(error, 'Could not start the chat');
  }
}

const BACKEND_BASE_URL = API_CONFIG.BASE_URL.replace(/\/api\/?$/, '');

/** Uploads use fetch so FormData gets a proper multipart boundary. */
export async function uploadChatFile(
  uri: string,
  fileName: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<UploadedFile> {
  const scope = getSupermarketScope();
  beginScopedWrite();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    if (signal?.aborted) throw new Error('Photo upload cancelled.');
    const token = await secureStorage.getToken();
    if (scope.generation !== getSupermarketScope().generation) throw new Error('Shop changed');
    const formData = await createChatUploadBody({ uri, name: fileName, mimeType }, Platform.OS);
    if (scope.generation !== getSupermarketScope().generation) throw new Error('Shop changed');

    const response = await fetch(`${API_CONFIG.BASE_URL}/chat/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(scope.id ? { 'X-Supermarket-Id': scope.id } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data.file?.url) {
      throw new Error(data?.message ?? data?.error ?? `Upload failed (${response.status})`);
    }
    if (scope.generation !== getSupermarketScope().generation) throw new Error('Shop changed');
    return data.file as UploadedFile;
  } catch (error) {
    if (signal?.aborted) throw new Error('Photo upload cancelled.');
    if (controller.signal.aborted) throw new Error('Photo upload timed out. Check your connection and try again.');
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancel);
    clearTimeout(timeout);
    endScopedWrite();
  }
}

/** Resolve a stored attachment path (e.g. /uploads/...) to a full URL. */
export function getAttachmentUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BACKEND_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
