import { useAuth } from '@/contexts/AuthContext';

/**
 * Shop owner = backend userType CUSTOMER. Employees see the same screens with
 * owner-only actions hidden (never show "admin only" messages).
 */
export function useIsOwner(): boolean {
  const { user } = useAuth();
  return user?.userType === 'CUSTOMER';
}
