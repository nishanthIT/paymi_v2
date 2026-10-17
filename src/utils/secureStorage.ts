/**
 * Cross-platform secure storage for sensitive values (auth tokens).
 *
 * - Native (iOS / Android): uses `expo-secure-store`, which stores values in
 *   the iOS Keychain and the Android EncryptedSharedPreferences / Keystore.
 * - Web fallback: uses AsyncStorage (no Keychain available in the browser).
 *
 * For App Store review, JWTs and refresh tokens must NOT live in plain
 * AsyncStorage / NSUserDefaults. This wrapper enforces that on device while
 * keeping a single read/write API.
 *
 * Migration helper `migrateLegacyToken` moves any pre-existing token from the
 * old AsyncStorage key (`auth_token`) into the secure store on first run, so
 * existing users are not logged out by the upgrade.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'paymi.auth_token';
const LEGACY_TOKEN_KEY = 'auth_token';
const LEGACY_ALT_TOKEN_KEY = 'authToken';
const USER_KEY = 'paymi.user';
const LEGACY_USER_KEY = 'user';
const SIGNED_OUT_KEY = 'paymi.session-signed-out';
let signedOut = false;
async function isSignedOut() {
  return signedOut || await AsyncStorage.getItem(SIGNED_OUT_KEY) === '1';
}

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

async function setItem(key: string, value: string) {
  if (isNative) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (isNative) {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(key);
}

async function deleteItem(key: string) {
  if (isNative) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

export const secureStorage = {
  async setSession(token: string, userJson: string) {
    signedOut = true;
    await AsyncStorage.setItem(SIGNED_OUT_KEY, '1');
    await setItem(USER_KEY, userJson);
    await setItem(TOKEN_KEY, token);
    await AsyncStorage.removeItem(SIGNED_OUT_KEY);
    signedOut = false;
  },
  async setToken(token: string) {
    await setItem(TOKEN_KEY, token);
  },
  async getToken(): Promise<string | null> {
    return await isSignedOut() ? null : getItem(TOKEN_KEY);
  },
  async clearToken() {
    await deleteItem(TOKEN_KEY);
    await Promise.allSettled([
      AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
      AsyncStorage.removeItem(LEGACY_ALT_TOKEN_KEY),
    ]);
  },
  async setUser(userJson: string) {
    await setItem(USER_KEY, userJson);
  },
  async getUser(): Promise<string | null> {
    return await isSignedOut() ? null : getItem(USER_KEY);
  },
  async clearUser() {
    await deleteItem(USER_KEY);
    await AsyncStorage.removeItem(LEGACY_USER_KEY);
  },
  async clearAll() {
    signedOut = true;
    // The non-secret marker prevents failed Keychain removal or legacy migration restoring a session.
    const marker = await Promise.allSettled([AsyncStorage.setItem(SIGNED_OUT_KEY, '1')]);
    const results = await Promise.allSettled([
      deleteItem(TOKEN_KEY),
      deleteItem(USER_KEY),
      AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
      AsyncStorage.removeItem(LEGACY_ALT_TOKEN_KEY),
      AsyncStorage.removeItem(LEGACY_USER_KEY),
    ]);
    if (results.some(result => result.status === 'rejected')) {
      throw new Error(marker[0].status === 'fulfilled'
        ? 'Signed out, but some saved sign-in data could not be erased. Retry when device storage is available.'
        : 'Saved sign-in data could not be erased. Keep this device secure and retry signing out.');
    }
  },
  /**
   * Moves any token previously stored in AsyncStorage under the legacy key
   * into the secure store. Safe to call on every app launch.
   */
  async migrateLegacyToken() {
    try {
      if (await isSignedOut()) return;
      const existing = await getItem(TOKEN_KEY);
      if (existing) return;
      let legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
      if (!legacy) {
        legacy = await AsyncStorage.getItem(LEGACY_ALT_TOKEN_KEY);
      }
      if (legacy) {
        await setItem(TOKEN_KEY, legacy);
        await Promise.allSettled([
          AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
          AsyncStorage.removeItem(LEGACY_ALT_TOKEN_KEY),
        ]);
      }
      const legacyUser = await AsyncStorage.getItem(LEGACY_USER_KEY);
      if (legacyUser) {
        await setItem(USER_KEY, legacyUser);
        await AsyncStorage.removeItem(LEGACY_USER_KEY);
      }
    } catch {
      // best-effort; never throw from a migration on startup
    }
  },
};

export default secureStorage;
