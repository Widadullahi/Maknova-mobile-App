import { Platform } from 'react-native';

import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'real_estate_access_token';
const REFRESH_TOKEN_KEY = 'real_estate_refresh_token';

let memoryAccessToken = null;
let memoryRefreshToken = null;

const isWeb = Platform.OS === 'web';

function webStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

export async function saveTokens(tokens, { persist = true } = {}) {
  memoryAccessToken = tokens?.accessToken || null;
  memoryRefreshToken = tokens?.refreshToken || null;

  if (!persist) {
    return;
  }

  const storage = webStorage();

  if (tokens?.accessToken) {
    if (isWeb && storage) {
      storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    } else {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
    }
  }

  if (tokens?.refreshToken) {
    if (isWeb && storage) {
      storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    } else {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
  }
}

export async function getAccessToken() {
  if (memoryAccessToken) {
    return memoryAccessToken;
  }
  const storage = webStorage();
  if (isWeb) {
    return storage?.getItem(ACCESS_TOKEN_KEY) ?? null;
  }
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  if (memoryRefreshToken) {
    return memoryRefreshToken;
  }
  const storage = webStorage();
  if (isWeb) {
    return storage?.getItem(REFRESH_TOKEN_KEY) ?? null;
  }
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  const storage = webStorage();
  if (isWeb) {
    storage?.removeItem(ACCESS_TOKEN_KEY);
    storage?.removeItem(REFRESH_TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}
