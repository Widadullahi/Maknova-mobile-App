import { apiClient } from './client';

export function registerUser(payload) {
  return apiClient.post('/auth/register', payload);
}

export function loginUser(payload) {
  return apiClient.post('/auth/login', payload);
}

export function fetchCurrentUser() {
  return apiClient.get('/auth/me');
}

export function requestPasswordReset(email) {
  return apiClient.post('/auth/password-reset/request', { email });
}

export function confirmPasswordReset(token, newPassword) {
  return apiClient.post('/auth/password-reset/confirm', { token, newPassword });
}
