import { selectSupermarket, selectRefreshedSupermarket, assertSwitchReady } from '@/features/supermarkets/selection';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupermarkets, type Supermarket, type SupermarketDirectory } from '@/features/supermarkets/api';
import { setSupermarketScope, hasScopedWrites } from '@/features/supermarkets/scope';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
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
  supermarkets: Supermarket[];
  activeSupermarket: Supermarket | null;
  canCreateSupermarket: boolean;
  shopsError: string | null;
  refreshSupermarkets: () => Promise<void>;
  switchSupermarket: (id: string) => Promise<void>;

}

const identityKey = (identity: AuthUser) => `${identity.userType}.${identity.id}`;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [directory, setDirectory] = useState<SupermarketDirectory | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shopsError, setShopsError] = useState<string | null>(null);
  const switchLock = useRef(false);
  const loadShops = useCallback(async (identity: AuthUser) => {
    const key = identityKey(identity);
    let data: SupermarketDirectory;
    try {
      data = await getSupermarkets();
      await AsyncStorage.setItem(`paymi.shops.${key}`, JSON.stringify(data));
      setShopsError(null);
    } catch (error: any) {
      // An offline launch can use its own saved directory. Every write is still authorized by the server.
      const cached = !error?.response && await AsyncStorage.getItem(`paymi.shops.${key}`);
      if (!cached) {
        setDirectory(null); setActiveId(null); setSupermarketScope(null);
        setShopsError('Unable to load your shops. Check your connection and try again.');
        return;
      }
      data = JSON.parse(cached);
    }
    const legacyCache = await AsyncStorage.getItem('paymi.query-cache.v1');
    if (legacyCache) {
      try {
        if (JSON.parse(legacyCache)?.clientState?.mutations?.length) setShopsError('Older unsynced changes are saved on this device. Contact support to verify their original account and shop before restoring them.');
      } catch { /* Leave old cache intact for review. */ }
    }
    const saved = await AsyncStorage.getItem(`paymi.active-shop.${key}`);
    const selected = selectSupermarket(data.supermarkets, saved, data.defaultSupermarketId);
    setDirectory(data); setActiveId(selected?.id ?? null); setSupermarketScope(selected?.id ?? null);
  }, []);
  const refreshSupermarkets = useCallback(async () => {
    if (!user) return;
    const data = await getSupermarkets();
    setDirectory(data);
    setShopsError((current) => current?.startsWith('Older unsynced changes') ? current : null);
    const storageKey = `paymi.active-shop.${identityKey(user)}`;
    const saved = await AsyncStorage.getItem(storageKey);
    const selected = selectRefreshedSupermarket(data.supermarkets, activeId, saved, data.defaultSupermarketId);
    const nextId = selected?.id ?? null;
    if (nextId !== activeId) {
      // A failed initial directory request must recover the valid default/sole
      // shop. Do not move in-flight or offline changes into another workspace.
      if (nextId) assertSwitchReady(queryClient.isMutating(), hasScopedWrites());
      await queryClient.cancelQueries();
      disconnectChatSocket();
      setSupermarketScope(nextId);
      setActiveId(nextId);
      if (nextId) await AsyncStorage.setItem(storageKey, nextId);
      else await AsyncStorage.removeItem(storageKey);
    }
    await AsyncStorage.setItem(`paymi.shops.${identityKey(user)}`, JSON.stringify(data));
  }, [user, activeId]);
  const switchSupermarket = useCallback(async (id: string) => {
    if (switchLock.current || !user || id === activeId) return;
    assertSwitchReady(queryClient.isMutating(), hasScopedWrites());
    switchLock.current = true;
    try {
      // Revalidate access online before entering a different shop.
      const data = await getSupermarkets();
      const selected = data.supermarkets.find((shop) => shop.id === id);
      if (!selected || !data.canSwitchOperationalContext) throw new Error('This shop is no longer available. Refresh your shops and try again.');
      assertSwitchReady(queryClient.isMutating(), hasScopedWrites());
      await queryClient.cancelQueries();
      await AsyncStorage.setItem(`paymi.active-shop.${identityKey(user)}`, id);
      if (queryClient.isMutating() || hasScopedWrites()) {
        if (activeId) await AsyncStorage.setItem(`paymi.active-shop.${identityKey(user)}`, activeId);
        else await AsyncStorage.removeItem(`paymi.active-shop.${identityKey(user)}`);
        throw new Error('Please wait for your changes to finish syncing.');
      }
      disconnectChatSocket();
      setSupermarketScope(id);
      setDirectory(data); setActiveId(id);
    } finally { switchLock.current = false; }
  }, [user, activeId]);


  // Restore persisted session once on launch.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const restoredUser = await authService.restoreSession();
        if (cancelled) return;
        if (restoredUser) await loadShops(restoredUser);
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
  }, [loadShops]);

  // Global logout — fired by the API layer when a token expires (401).
  useEffect(() => {
    const unsubscribe = authEvents.subscribe(() => {
      disconnectChatSocket();
      queryClient.clear();
      setSupermarketScope(null); setDirectory(null); setActiveId(null);
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
        if (fresh) { setUser(fresh); await refreshSupermarkets(); }
      } catch (error: any) {
        logger.warn('Access refresh failed:', error?.message);
      }
    });
    return () => sub.remove();
  }, [status, refreshSupermarkets]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials);
    await loadShops(response.user);
    setUser(response.user);
    setStatus('authenticated');
  }, [loadShops]);

  const register = useCallback(async (data: RegisterData) => {
    const response = await authService.register(data);
    await loadShops(response.user);
    setUser(response.user);
    setStatus('authenticated');
  }, [loadShops]);

  const logout = useCallback(async () => {
    try { await authService.logout(); }
    finally {
    disconnectChatSocket();
    queryClient.clear();
    setSupermarketScope(null); setDirectory(null); setActiveId(null);
    setUser(null);
    setStatus('unauthenticated');
    }
  }, []);

  const activeSupermarket = directory?.supermarkets.find((shop) => shop.id === activeId) ?? null;
  const scopedUser = useMemo(() => user ? { ...user, shopId: activeId ?? undefined,
    shopAccess: user.userType === 'EMPLOYEE' && activeSupermarket ? {
      shopId: activeSupermarket.id, shopName: activeSupermarket.name, role: 'EMPLOYEE', permissions: activeSupermarket.permissions,
    } : null,
  } : null, [user, activeId, activeSupermarket]);
  const value = useMemo<AuthContextValue>(
    () => ({
      user: scopedUser,
      status,
      supermarkets: directory?.supermarkets ?? [], activeSupermarket,
      canCreateSupermarket: !!directory?.canCreateAdditional, shopsError, refreshSupermarkets, switchSupermarket,
      isRestoring: status === 'restoring',
      isAuthenticated: status === 'authenticated',
      login,
      register,
      logout,
    }),
    [scopedUser, status, login, register, logout, directory, activeSupermarket, shopsError, refreshSupermarkets, switchSupermarket],
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
