import { apiClient } from './client';

export function requestEmailVerification(email) {
  return apiClient.post('/auth/email-verification/request', { email });
}

export function verifyEmailCode(email, code) {
  return apiClient.post('/auth/email-verification/verify', { email, code });
}