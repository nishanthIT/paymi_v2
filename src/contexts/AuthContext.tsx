import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import authService, {
  AuthUser,
  LoginCredentials,
  RegisterData,
} from '@/services/authService';
import { queryClient } from '@/lib/query-client';
import { disconnectChatSocket } from '@/features/chat/socket';
import { authEvents } from '@/utils/authEvents';
import { logger } from '@/utils/logger';

type AuthStatus = 'restoring' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** True while the initial session restore is in flight. */
  isRestoring: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('restoring');

  // Restore persisted session once on launch.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const restoredUser = await authService.restoreSession();
        if (cancelled) return;
        setUser(restoredUser);
        setStatus(restoredUser ? 'authenticated' : 'unauthenticated');
      } catch (error: any) {
        logger.warn('Session restore failed:', error?.message);
        if (!cancelled) {
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Global logout — fired by the API layer when a token expires (401).
  useEffect(() => {
    const unsubscribe = authEvents.subscribe(() => {
      disconnectChatSocket();
      queryClient.clear();
      setUser(null);
      setStatus('unauthenticated');
    });
    return unsubscribe;
  }, []);

  // Owners can change an employee's shop access at any time; pick it up when the app is reopened.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      try {
        const fresh = await authService.restoreSession();
        if (fresh) setUser(fresh);
      } catch (error: any) {
        logger.warn('Access refresh failed:', error?.message);
      }
    });
    return () => sub.remove();
  }, [status]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials);
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const response = await authService.register(data);
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    disconnectChatSocket();
    queryClient.clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isRestoring: status === 'restoring',
      isAuthenticated: status === 'authenticated',
      login,
      register,
      logout,
    }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
