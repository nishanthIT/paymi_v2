import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import { getChatSocket } from '@/features/chat/socket';

interface TemperatureAlertPayload {
  message?: string;
  fridgeName?: string;
  temperature?: number;
}

/**
 * Global listener for out-of-range temperature readings. Mount once (tabs
 * layout): the backend emits `temperature_alert` to everyone at the shop the
 * moment any reading falls outside its safe range.
 */
export function useTemperatureAlerts() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const socket = await getChatSocket();
      if (!socket || cancelled) return;

      const onAlert = (payload?: TemperatureAlertPayload) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        showToast(payload?.message ?? 'Temperature alert at your shop', 'error');
        queryClient.invalidateQueries({ queryKey: ['fridges'] });
      };

      socket.on('temperature_alert', onAlert);
      cleanup = () => socket.off('temperature_alert', onAlert);
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [isAuthenticated, queryClient, showToast]);
}
