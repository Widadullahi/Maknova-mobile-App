import { apiClient } from './client';

export function fetchMyWallet() {
  return apiClient.get('/wallet/me');
}

export function initializeWalletTopup(amount) {
  return apiClient.post('/wallet/topup/initialize', { amount });
}

export function verifyWalletTopup(reference) {
  return apiClient.get(`/wallet/topup/verify/${reference}`);
}
