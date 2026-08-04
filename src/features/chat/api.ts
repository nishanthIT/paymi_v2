import { API_CONFIG } from '@/config/api';
import api from '@/services/api';
import { secureStorage } from '@/utils/secureStorage';

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

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  const message = error?.response?.data?.message ?? error?.response?.data?.error ?? fallback;
  return new Error(message);
}

export async function fetchChats(): Promise<ChatSummary[]> {
  try {
    const response = await api.get('/chat');
    return response.data?.chats ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load chats');
  }
}

export async function fetchChatPage(chatId: string, page: number): Promise<ChatThreadPage> {
  try {
    const response = await api.get(`/chat/${chatId}`, {
      params: { page, limit: MESSAGES_PAGE_SIZE },
    });
    return response.data?.chat;
  } catch (error: any) {
    throw apiError(error, 'Could not load messages');
  }
}

export async function sendChatMessage(input: SendMessageInput) {
  try {
    const response = await api.post('/chat/message', {
      messageType: 'TEXT',
      ...input,
    });
    return response.data?.message;
  } catch (error: any) {
    throw apiError(error, 'Message failed to send');
  }
}

export async function markMessagesRead(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  try {
    await api.post('/chat/read', { messageIds });
  } catch {
    // Read receipts are best-effort — never surface an error for them.
  }
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  try {
    await api.delete(`/chat/message/${messageId}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete the message');
  }
}

export async function deleteChat(chatId: string): Promise<void> {
  try {
    await api.delete(`/chat/${chatId}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete the chat');
  }
}

export async function fetchChatUsers(search?: string): Promise<DirectoryUser[]> {
  try {
    const response = await api.get('/chat/users', {
      params: search ? { search } : undefined,
    });
    return response.data?.users ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load contacts');
  }
}

export async function createChat(input: {
  type: ChatType;
  participantIds: { userId: number; userType: ChatUserType }[];
  name?: string;
}): Promise<ChatSummary> {
  try {
    const response = await api.post('/chat', input);
    return response.data?.chat;
  } catch (error: any) {
    throw apiError(error, 'Could not start the chat');
  }
}

const BACKEND_BASE_URL = API_CONFIG.BASE_URL.replace(/\/api\/?$/, '');

/** Uploads use fetch so FormData gets a proper multipart boundary. */
export async function uploadChatFile(
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<UploadedFile> {
  const token = await secureStorage.getToken();
  const fileUri =
    uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http')
      ? uri
      : `file://${uri}`;

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType || 'image/jpeg',
  } as any);

  const response = await fetch(`${API_CONFIG.BASE_URL}/chat/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
  const data = await response.json();
  if (!data?.success) {
    throw new Error(data?.message ?? 'Upload failed');
  }
  return data.file as UploadedFile;
}

/** Resolve a stored attachment path (e.g. /uploads/...) to a full URL. */
export function getAttachmentUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BACKEND_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
