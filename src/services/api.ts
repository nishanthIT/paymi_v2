import axios from 'axios';
import { API_CONFIG } from '@/config/api';
import { authEvents } from '@/utils/authEvents';
import { secureStorage } from '@/utils/secureStorage';
import { logger } from '@/utils/logger';

logger.log('API Service initialized with BASE_URL:', API_CONFIG.BASE_URL);

// 20 s timeout absorbs cold-start latency on serverless backends.
// eslint-disable-next-line import/no-named-as-default-member
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor — attach Bearer token from secure storage.
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await secureStorage.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error: any) {
      logger.warn('Failed to read auth token from secure storage:', error?.message);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — global 401 handler triggers silent logout.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      logger.log('401 Unauthorized — clearing session');
      await secureStorage.clearAll();
      authEvents.emitLogout();
      return Promise.reject({ silent: true, status: 401 });
    }
    return Promise.reject(error);
  },
);

export default api;
