import { Alert } from 'react-native';
import { authEvents } from '@/utils/authEvents';
import { getSupermarketScope } from '@/features/supermarkets/scope';
import { io, type Socket } from 'socket.io-client';

import { API_CONFIG } from '@/config/api';
import { logger } from '@/utils/logger';
import { secureStorage } from '@/utils/secureStorage';

const SOCKET_URL = API_CONFIG.BASE_URL.replace(/\/api\/?$/, '');

let socket: Socket | null = null;
let socketToken: string | null = null;
let socketScope: string | null = null;

/**
 * Lazily-connected singleton Socket.IO client authenticated with the JWT.
 * The server auto-joins the user's personal room on connect.
 */
export async function getChatSocket(): Promise<Socket | null> {
  const scope = getSupermarketScope();
  let token: string | null;
  try { token = await secureStorage.getToken(); }
  catch { logger.warn('Chat sign-in could not be loaded; will retry on reconnect.'); return null; }
  if (scope.generation !== getSupermarketScope().generation) return null;
  if (!token) return null;
  if (socket && socketScope !== scope.id) disconnectChatSocket();

  if (!socket) {
    socketToken = token;
    socketScope = scope.id;
    socket = io(SOCKET_URL, {
      auth: { token, supermarketId: scope.id ?? undefined },
      // Try polling when a client network/proxy blocks WebSocket upgrades.
      transports: ['websocket', 'polling'],
      tryAllTransports: true,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
    });
    const currentSocket = socket;
    let lastFailure: { key: string; at: number } | undefined;
    socket.on('connect', () => { lastFailure = undefined; });
    socket.on('account_suspended', async ({ until, reason }) => {
      Alert.alert('Account temporarily suspended', `Access is suspended until ${new Date(until).toLocaleString()}. ${reason} Contact support@paymi.co.uk to appeal.`);
      try { await secureStorage.clearAll(); } catch { logger.warn('Saved sign-in erasure needs retry'); } finally { authEvents.emitLogout(); }
    });
    socket.on('connect_error', (error) => {
      // Log only safe connection metadata, never the XHR/request/auth object.
      const details = error as Error & { description?: unknown; context?: { status?: unknown } };
      const status = typeof details.description === 'number' ? details.description : details.context?.status;
      const httpStatus = typeof status === 'number' && Number.isInteger(status) && status >= 0 && status <= 599 ? status : undefined;
      const message = details.message || '';
      const reason = ['xhr poll error', 'xhr post error', 'websocket error', 'timeout'].includes(message) ? message
        : /^Authentication/i.test(message) ? 'authentication rejected'
        : /temporarily restricted/i.test(message) ? 'temporarily restricted'
        : /Too many/i.test(message) ? 'connection throttled' : 'connection failed';
      const key = `${reason}:${httpStatus ?? 'unknown'}`;
      const now = Date.now();
      if (lastFailure?.key === key && now - lastFailure.at < 30000) return;
      lastFailure = { key, at: now };
      logger.warn('Chat connection unavailable', {
        endpoint: new URL(SOCKET_URL).origin,
        environment: API_CONFIG.ENVIRONMENT,
        reason, httpStatus,
        retrying: currentSocket.active,
      });
    });
    socket.on('auth_error', () => logger.warn('Chat socket auth failed'));
  } else {
    const tokenChanged = socketToken !== token;
    socketToken = token;
    socket.auth = { token, supermarketId: scope.id ?? undefined };
    // Updating .auth alone does not reauthenticate an already-connected socket.
    if (tokenChanged) socket.disconnect();
    // Existing consumers must not restart an in-progress attempt/backoff timer.
    if (!socket.active) socket.connect();
  }
  return socket;
}

export function disconnectChatSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  socketToken = null;
  socketScope = null;
}

export function joinChatRoom(chatId: string) {
  socket?.emit('join_chat', chatId);
}

export function leaveChatRoom(chatId: string) {
  socket?.emit('leave_chat', chatId);
}

export function emitTypingStart(chatId: string, userInfo: { id: number; name: string }) {
  if (socket?.connected) socket.emit('typing_start', { chatId, userInfo });
}

export function emitTypingStop(chatId: string, userInfo: { id: number; name: string }) {
  if (socket?.connected) socket.emit('typing_stop', { chatId, userInfo });
}

/** Join the shop room so shared-list changes stream in live. */
export function joinShopLists(shopId: string) {
  socket?.emit('join_shop_lists', shopId);
}

export function leaveShopLists(shopId: string) {
  socket?.emit('leave_shop_lists', shopId);
}
