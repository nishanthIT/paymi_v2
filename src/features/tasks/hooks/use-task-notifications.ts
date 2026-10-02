import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import { getChatSocket } from '@/features/chat/socket';

interface TaskAssignedPayload {
  taskId?: string;
  taskName?: string;
  assignedBy?: string;
  shopName?: string;
}

/**
 * Global listener for `task_assigned` (emitted to the employee's personal room).
 * Mount once in the tabs layout; refreshes the task list and the Tasks badge.
 */
export function useTaskNotifications() {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const isEmployee = user?.userType === 'EMPLOYEE';
  const seenTaskIds = useRef(new Set<string>());

  useEffect(() => {
    if (!isAuthenticated || !isEmployee) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const socket = await getChatSocket();
      if (!socket || cancelled) return;

      const onAssigned = (payload?: TaskAssignedPayload) => {
        // Socket reconnects can replay the event — notify once per task.
        if (payload?.taskId) {
          if (seenTaskIds.current.has(payload.taskId)) return;
          seenTaskIds.current.add(payload.taskId);
        }
        const from = payload?.assignedBy ?? payload?.shopName;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showToast(
          payload?.taskName
            ? `New task: "${payload.taskName}"${from ? ` from ${from}` : ''}`
            : 'New task assigned — tap to view',
          'info',
          {
            durationMs: 6000,
            onPress: () => router.push('/(app)/task-management'),
          },
        );
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      };

      socket.on('task_assigned', onAssigned);
      cleanup = () => socket.off('task_assigned', onAssigned);
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [isAuthenticated, isEmployee, queryClient, router, showToast]);
}
