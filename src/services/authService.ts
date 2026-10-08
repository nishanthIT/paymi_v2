import { isAxiosError } from 'axios';
import api from './api';
import { secureStorage } from '@/utils/secureStorage';
import { logger } from '@/utils/logger';

// 401s are handled globally in the api interceptor (silent logout).
const isSilent401 = (error: any) => error?.silent === true && error?.status === 401;

export interface ShopAccess {
  shopId: string;
  shopName?: string | null;
  role: 'EMPLOYEE' | 'MANAGER' | string;
  permissions: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  userType: 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER' | string;
  subscriptionStatus?: string;
  trialEndDate?: string;
  shopId?: string;
  /** Shop membership of a shop employee; independent of any company staff access. */
  shopAccess?: ShopAccess | null;
  [key: string]: unknown;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  otp?: string;
  shopName?: string;
}

export interface OtpRequestResponse {
  success: boolean;
  message: string;
  resendIn?: number;
  expiresIn?: number;
}

export interface AuthResponse {
  message: string;
  user: AuthUser;
  token: string;
}

/** Turn axios/network errors into user-friendly messages. */
function toAuthError(error: unknown, fallback: string): Error {
  if (isAxiosError(error)) {
    if (error.response?.data?.error) return new Error(error.response.data.error);
    if (error.code === 'ECONNABORTED') {
      return new Error('The server is taking too long to respond. Please try again.');
    }
    if (!error.response) {
      return new Error('Unable to reach the server. Check your connection and try again.');
    }
  }
  return new Error(fallback);
}

class AuthService {
  private async persistSession(response: AuthResponse): Promise<void> {
    if (response.token) {
      await secureStorage.setToken(response.token);
      await secureStorage.setUser(JSON.stringify(response.user));
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      await this.persistSession(response.data);
      return response.data;
    } catch (error) {
      logger.warn('Login failed');
      throw toAuthError(error, 'Login failed. Please try again.');
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/register', data);
      await this.persistSession(response.data);
      return response.data;
    } catch (error) {
      logger.warn('Registration failed');
      throw toAuthError(error, 'Registration failed. Please try again.');
    }
  }

  /** Step 1 of registration: sends a 6-digit verification code to the email. */
  async sendRegisterOtp(data: Omit<RegisterData, 'otp'>): Promise<OtpRequestResponse> {
    try {
      const response = await api.post<OtpRequestResponse>('/auth/register/send-otp', data);
      return response.data;
    } catch (error) {
      logger.warn('Sending registration code failed');
      throw toAuthError(error, 'Could not send the verification code. Please try again.');
    }
  }

  /** Sends a password reset code. The server responds generically for privacy. */
  async forgotPassword(email: string): Promise<OtpRequestResponse> {
    try {
      const response = await api.post<OtpRequestResponse>('/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      logger.warn('Forgot password request failed');
      throw toAuthError(error, 'Could not send the reset code. Please try again.');
    }
  }

  /** Verifies the reset code and sets the new password. */
  async resetPassword(data: { email: string; otp: string; newPassword: string }): Promise<void> {
    try {
      await api.post('/auth/reset-password', data);
    } catch (error) {
      logger.warn('Password reset failed');
      throw toAuthError(error, 'Could not reset your password. Please try again.');
    }
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best effort — the local session is cleared regardless.
    } finally {
      await secureStorage.clearAll();
    }
  }

  async getStoredUser(): Promise<AuthUser | null> {
    try {
      const userStr = await secureStorage.getUser();
      return userStr ? (JSON.parse(userStr) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  /**
   * Restore the persisted session on app launch.
   *
   * - No token → null (signed out).
   * - Token rejected by the server (401) → session cleared by the interceptor → null.
   * - Server unreachable → fall back to the locally stored user so people are
   *   not logged out just because they opened the app offline.
   */
  async restoreSession(): Promise<AuthUser | null> {
    await secureStorage.migrateLegacyToken();

    const token = await secureStorage.getToken();
    if (!token) {
      logger.log('No stored session found');
      return null;
    }

    try {
      const response = await api.get('/auth/me');
      const user: AuthUser | undefined = response.data?.user;
      if (user) {
        await secureStorage.setUser(JSON.stringify(user));
        logger.log('Session restored for', user.email);
        return user;
      }
      return null;
    } catch (error: any) {
      if (isSilent401(error)) {
        logger.log('Stored token expired — signed out');
        return null;
      }
      // Network/server error: keep the session alive using cached user data.
      const cached = await this.getStoredUser();
      if (cached) {
        logger.warn('Could not validate session online, using cached user');
        return cached;
      }
      return null;
    }
  }
}

export default new AuthService();
