import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getChatSocket } from '../socket';

const subscribeOnline = (callback: () => void) => onlineManager.subscribe(callback);
const getOnline = () => onlineManager.isOnline();

/** HTTP remains usable when a network blocks the realtime transport. */
export function useChatConnection() {
  const { isAuthenticated, activeSupermarket } = useAuth();
  const shopId = activeSupermarket?.id;
  const isOnline = useSyncExternalStore(subscribeOnline, getOnline, () => true);
  const [connection, setConnection] = useState<{ connected: boolean; shopId?: string }>({ connected: false });
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    if (!isAuthenticated || !shopId) return;
    void getChatSocket().then(socket => {
      if (!socket || cancelled) return;
      const update = () => setConnection(previous => {
        // Reconnect failures can repeat for minutes. Preserve the state object
        // while still disconnected so every attempt does not redraw chat lists.
        const connected = socket.connected;
        return previous.connected === connected && previous.shopId === shopId
          ? previous : { connected, shopId };
      });
      update();
      socket.on('connect', update);
      socket.on('disconnect', update);
      socket.on('connect_error', update);
      cleanup = () => { socket.off('connect', update); socket.off('disconnect', update); socket.off('connect_error', update); };
    });
    return () => { cancelled = true; cleanup?.(); };
  }, [isAuthenticated, shopId, isOnline]);
  return { isOnline, isConnected: isOnline && isAuthenticated && connection.shopId === shopId && connection.connected };
}
