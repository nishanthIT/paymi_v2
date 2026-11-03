import { Alert, Platform } from 'react-native';
import { getSupermarketScope, beginScopedWrite, endScopedWrite } from '@/features/supermarkets/scope';
import axios, { CanceledError, isCancel, type InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from '@/config/api';
import { authEvents } from '@/utils/authEvents';
import { secureStorage } from '@/utils/secureStorage';
import { logger } from '@/utils/logger';
type ScopedConfig = InternalAxiosRequestConfig & { supermarketGeneration?: number; scopedWrite?: boolean };

logger.log('API Service initialized with BASE_URL:', API_CONFIG.BASE_URL);

// Authenticated shop requests share the same database-backed session checks.
// The configured timeout may increase, but cannot undercut the measured slow-link budget.
// eslint-disable-next-line import/no-named-as-default-member
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  // Native sessions use the SecureStore bearer token. An expired cookie left
  // in the OS cookie jar must not turn a new login/reset into a cookie-only
  // request without Origin and trigger the browser CSRF guard.
  withCredentials: Platform.OS === 'web',
});

// Request interceptor — attach Bearer token from secure storage.
api.interceptors.request.use(
  async (config: ScopedConfig) => {
    // Shop selection, lists, employees and products must have the same budget
    // as login: a 10-second directory timeout previously hid authorized tools.
    // Keep one bounded request; never automatically retry a possibly committed write.
    config.timeout = Math.max(config.timeout ?? API_CONFIG.TIMEOUT, 45000);
    const captured = getSupermarketScope();
    config.supermarketGeneration = captured.generation;
    if (!config.url?.startsWith('/auth/') && config.headers['X-Supermarket-Id'] !== null && captured.id) {
      config.headers['X-Supermarket-Id'] = captured.id;
    }
    config.scopedWrite = !['get', 'head', 'options'].includes(config.method || 'get');
    if (config.scopedWrite) beginScopedWrite();
    try {
      const token = await secureStorage.getToken();
      if (captured.generation !== getSupermarketScope().generation) {
        if (config.scopedWrite) { endScopedWrite(); config.scopedWrite = false; }
        throw new CanceledError('Shop changed', config);
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error: any) {
      if (isCancel(error)) throw error;
      logger.warn('Failed to read auth token from secure storage:', error?.message);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — global 401 handler triggers silent logout.
api.interceptors.response.use(
  (response) => {
    const config = response.config as ScopedConfig;
    if (config.scopedWrite) endScopedWrite();
    if (config.supermarketGeneration !== getSupermarketScope().generation) throw new CanceledError('Shop changed');
    return response;
  },
  async (error) => {
    const config = error?.config as ScopedConfig | undefined;
    if (config?.scopedWrite) endScopedWrite();
    if (config && config.supermarketGeneration !== getSupermarketScope().generation) return Promise.reject(new CanceledError('Shop changed'));
    if (error?.response?.status === 401 || error?.response?.data?.code === 'ACCOUNT_SUSPENDED') {
      if (error?.response?.data?.code === 'ACCOUNT_SUSPENDED') Alert.alert('Account temporarily suspended', error.response.data.error);
      logger.log('401 Unauthorized — clearing session');
      try { await secureStorage.clearAll(); }
      catch { logger.warn('Saved sign-in erasure needs retry'); }
      finally { authEvents.emitLogout(); }
      return Promise.reject({ silent: true, status: 401 });
    }
    return Promise.reject(error);
  },
);

export default api;
