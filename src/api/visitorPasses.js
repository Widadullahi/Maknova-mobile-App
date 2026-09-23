import { apiClient } from './client';

export function fetchVisitorPasses() {
  return apiClient.get('/visitor-passes');
}

export function createVisitorPass(payload) {
  return apiClient.post('/visitor-passes', payload);
}

export function verifyVisitorPass(payload) {
  return apiClient.post('/visitor-passes/verify', payload);
}

export function checkOutVisitorPass(payload) {
  return apiClient.post('/visitor-passes/verify', { ...payload, action: 'check_out' });
}
