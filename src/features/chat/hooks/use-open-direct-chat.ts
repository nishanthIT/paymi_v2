import { useCallback, useEffect, useRef } from 'react';
import { useIsFocused, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { getSupermarketScope } from '@/features/supermarkets/scope';
import { findDirectChat } from '../direct';
import { chatKeys } from '../keys';
import type { DirectoryUser, ChatUserType } from '../types';

/** Navigate immediately; room initialization runs in a cancellable screen. */
export function useOpenDirectChat() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const focused = useIsFocused();
  const opening = useRef(false);
  useEffect(() => { if (focused) opening.current = false; }, [focused]);
  return useCallback((recipient: Pick<DirectoryUser, 'id' | 'name' | 'userType'>) => {
    if (opening.current) return;
    opening.current = true;
    const existing = findDirectChat(queryClient.getQueryData(chatKeys.all),
      { userId: Number(user?.id), userType: user?.userType as ChatUserType },
      { userId: Number(recipient.id), userType: recipient.userType }, getSupermarketScope().id);
    if (existing) {
      router.push({ pathname: '/(app)/chat/[id]', params: { id: existing.id, name: recipient.name, type: 'PERSONAL' } });
    } else {
      router.push({ pathname: '/(app)/chat/start', params: { userId: recipient.id, userType: recipient.userType, name: recipient.name } });
    }
  }, [queryClient, router, user?.id, user?.userType]);
}
