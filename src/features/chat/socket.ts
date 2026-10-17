import { Alert } from 'react-native';
import { authEvents } from '@/utils/authEvents';
import { getSupermarketScope } from '@/features/supermarkets/scope';
import { io, type Socket } from 'socket.io-client';

import { API_CONFIG } from '@/config/api';
import { logger } from '@/utils/logger';
import { secureStorage } from '@/utils/secureStorage';

const SOCKET_URL = API_CONFIG.BASE_URL.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

/**
 * Lazily-connected singleton Socket.IO client authenticated with the JWT.
 * The server auto-joins the user's personal room on connect.
 */
export async function getChatSocket(): Promise<Socket | null> {
  const scope = getSupermarketScope();
  const token = await secureStorage.getToken();
  if (scope.generation !== getSupermarketScope().generation) return null;
  if (!token) return null;

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token, supermarketId: scope.id ?? undefined },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelayMax: 5000,
    });
    socket.on('account_suspended', async ({ until, reason }) => {
      Alert.alert('Account temporarily suspended', `Access is suspended until ${new Date(until).toLocaleString()}. ${reason} Contact support@paymi.co.uk to appeal.`);
      try { await secureStorage.clearAll(); } catch { logger.warn('Saved sign-in erasure needs retry'); } finally { authEvents.emitLogout(); }
    });
    socket.on('connect_error', (error) => logger.warn('Chat socket error:', error?.message));
    socket.on('auth_error', () => logger.warn('Chat socket auth failed'));
  } else {
    (socket.auth as { token?: string }).token = token;
    if (socket.disconnected) socket.connect();
  }
  return socket;
}

export function disconnectChatSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

export function joinChatRoom(chatId: string) {
  socket?.emit('join_chat', chatId);
}

export function leaveChatRoom(chatId: string) {
  socket?.emit('leave_chat', chatId);
}

export function emitTypingStart(chatId: string, userInfo: { id: number; name: string }) {
  socket?.emit('typing_start', { chatId, userInfo });
}

export function emitTypingStop(chatId: string, userInfo: { id: number; name: string }) {
  socket?.emit('typing_stop', { chatId, userInfo });
}

/** Join the shop room so shared-list changes stream in live. */
export function joinShopLists(shopId: string) {
  socket?.emit('join_shop_lists', shopId);
}

export function leaveShopLists(shopId: string) {
  socket?.emit('leave_shop_lists', shopId);
}
