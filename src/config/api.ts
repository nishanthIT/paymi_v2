// ============================================
// 🔧 API CONFIGURATION
// ============================================
// This file manages all API endpoints and environment settings
// To switch environments, update the .env file (EXPO_PUBLIC_ENV)

// ============================================
// 📦 ENVIRONMENT VARIABLES (from .env file)
// ============================================
const ENV = (process.env.EXPO_PUBLIC_ENV || 'PRODUCTION').trim().toUpperCase();
const PRODUCTION_URL = (process.env.EXPO_PUBLIC_PRODUCTION_URL || 'https://backend.h7tex.com').trim();
const LOCAL_IP = (process.env.EXPO_PUBLIC_LOCAL_IP || '172.20.10.3').trim();
const LOCAL_PORT = (process.env.EXPO_PUBLIC_LOCAL_PORT || '3000').trim();
const API_TIMEOUT = parseInt((process.env.EXPO_PUBLIC_API_TIMEOUT || '10000').trim(), 10);

// Detect if running in web browser (use localhost) or on device (use IP)
const IS_WEB = typeof window !== 'undefined' && typeof document !== 'undefined';

// ============================================
// 🌐 URL CONFIGURATION
// ============================================
const URLS = {
  PRODUCTION: PRODUCTION_URL,
  LOCAL: IS_WEB ? `http://localhost:${LOCAL_PORT}` : `http://${LOCAL_IP}:${LOCAL_PORT}`,
  LOCALHOST: 'http://localhost:3000',
  ANDROID_EMULATOR: 'http://10.0.2.2:3000',
} as const;

// Log which URL is being used
console.log(`🌐 API Config: ENV=${ENV}, IS_WEB=${IS_WEB}, LOCAL_URL=${URLS.LOCAL}`);

// ============================================
// 🎯 ACTIVE CONFIGURATION
// ============================================
type Environment = 'LOCAL' | 'PRODUCTION';
const ENVIRONMENT: Environment = (ENV === 'LOCAL' ? 'LOCAL' : 'PRODUCTION') as Environment;

const BASE_URL = ENVIRONMENT === 'PRODUCTION' ? URLS.PRODUCTION : URLS.LOCAL;

// ============================================
// 📤 EXPORTS
// ============================================
export const API_CONFIG = {
  // Core URLs
  BASE_URL: `${BASE_URL}/api`,
  SOCKET_URL: BASE_URL,
  TIMEOUT: API_TIMEOUT,
  
  // Environment info
  ENVIRONMENT,
  IS_PRODUCTION: ENVIRONMENT === 'PRODUCTION',
  IS_LOCAL: ENVIRONMENT === 'LOCAL',
  
  // Alternative URLs for debugging
  URLS: {
    PRODUCTION: `${URLS.PRODUCTION}/api`,
    LOCAL: `${URLS.LOCAL}/api`,
    LOCALHOST: `${URLS.LOCALHOST}/api`,
    ANDROID_EMULATOR: `${URLS.ANDROID_EMULATOR}/api`,
  },
};

// Shorthand exports
export const API_BASE_URL = API_CONFIG.BASE_URL;
export const SOCKET_URL = API_CONFIG.SOCKET_URL;

// ============================================
// 🔗 API ENDPOINTS
// ============================================
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: `${API_CONFIG.BASE_URL}/auth/login`,
    REGISTER: `${API_CONFIG.BASE_URL}/auth/register`,
    VERIFY: `${API_CONFIG.BASE_URL}/auth/me`,
    FORGOT_PASSWORD: `${API_CONFIG.BASE_URL}/auth/forgot-password`,
    EXTEND_TRIAL: `${API_CONFIG.BASE_URL}/auth/extend-trial`,
  },
  
  // Lists
  LISTS: {
    BASE: `${API_CONFIG.BASE_URL}/lists`,
    GET_ALL: `${API_CONFIG.BASE_URL}/lists`,
    CREATE: `${API_CONFIG.BASE_URL}/lists`,
    GET_BY_ID: (id: string) => `${API_CONFIG.BASE_URL}/lists/${id}`,
    ADD_PRODUCT: `${API_CONFIG.BASE_URL}/lists/addProduct`,
    REMOVE_PRODUCT: `${API_CONFIG.BASE_URL}/lists/removeProduct`,
    UPDATE_QUANTITY: `${API_CONFIG.BASE_URL}/lists/updateQuantity`,
  },
  
  // Products
  PRODUCTS: {
    BASE: `${API_CONFIG.BASE_URL}/products`,
    SEARCH: `${API_CONFIG.BASE_URL}/products/search`,
    BY_BARCODE: (barcode: string) => `${API_CONFIG.BASE_URL}/products/barcode/${barcode}`,
  },
  
  // Chat
  CHAT: {
    BASE: `${API_CONFIG.BASE_URL}/chat`,
    MESSAGES: (chatId: string) => `${API_CONFIG.BASE_URL}/chat/${chatId}/messages`,
  },
  
  // Reports
  REPORTS: {
    BASE: `${API_CONFIG.BASE_URL}/reports`,
  },
  
  // Legacy flat exports (for backward compatibility)
  LOGIN: `${API_CONFIG.BASE_URL}/auth/login`,
  REGISTER: `${API_CONFIG.BASE_URL}/auth/register`,
  VERIFY: `${API_CONFIG.BASE_URL}/auth/me`,
  FORGOT_PASSWORD: `${API_CONFIG.BASE_URL}/auth/forgot-password`,
  EXTEND_TRIAL: `${API_CONFIG.BASE_URL}/auth/extend-trial`,
  CHAT_LEGACY: `${API_CONFIG.BASE_URL}/chat`,
  LISTS_LEGACY: `${API_CONFIG.BASE_URL}/lists`,
  REPORTS_LEGACY: `${API_CONFIG.BASE_URL}/reports`,
};

// ============================================
// 🛠️ HELPER FUNCTIONS
// ============================================
export const getApiUrl = (): string => API_CONFIG.BASE_URL;

export const getEnvironmentInfo = () => ({
  environment: ENVIRONMENT,
  baseUrl: API_CONFIG.BASE_URL,
  socketUrl: API_CONFIG.SOCKET_URL,
  isProduction: API_CONFIG.IS_PRODUCTION,
});

// Debug helper - logs current configuration
export const logApiConfig = () => {
  console.log('=== API Configuration ===');
  console.log('Environment:', ENVIRONMENT);
  console.log('Base URL:', API_CONFIG.BASE_URL);
  console.log('Socket URL:', API_CONFIG.SOCKET_URL);
  console.log('Is Production:', API_CONFIG.IS_PRODUCTION);
  console.log('========================');
};

export default API_CONFIG;
