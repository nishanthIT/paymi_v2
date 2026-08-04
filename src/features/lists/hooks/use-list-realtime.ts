import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { getChatSocket, joinShopLists, leaveShopLists } from '@/features/chat/socket';

import { listKeys } from '../keys';

/**
 * Global realtime subscription for shared shopping lists. Mount once (tabs
 * layout): joins the shop socket room and keeps every list cache live so a
 * shared list behaves like a collaborative document — products, quantities,
 * check-offs and renames stream in for owner and trackers alike.
 */
export function useListRealtime() {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  const shopId = user?.shopId;

  useEffect(() => {
    if (!isAuthenticated || !shopId) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const socket = await getChatSocket();
      if (!socket || cancelled) return;

      // Join now and re-join on every (re)connect — server room membership is
      // lost when the socket drops.
      const join = () => joinShopLists(shopId);
      join();
      socket.on('connect', join);

      const invalidate = (data?: { listId?: string }) => {
        if (data?.listId) {
          queryClient.invalidateQueries({ queryKey: listKeys.detail(data.listId) });
        }
        queryClient.invalidateQueries({ queryKey: listKeys.all });
      };

      const events = [
        'list_created',
        'list_updated',
        'list_deleted',
        'list_product_added',
        'list_product_updated',
        'list_product_removed',
      ] as const;
      events.forEach((event) => socket.on(event, invalidate));

      cleanup = () => {
        socket.off('connect', join);
        events.forEach((event) => socket.off(event, invalidate));
        leaveShopLists(shopId);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [isAuthenticated, shopId, queryClient]);
}
