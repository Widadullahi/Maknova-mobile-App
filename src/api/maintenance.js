import { apiClient } from './client';

export function fetchMaintenanceProviders(category) {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiClient.get(`/maintenance/providers${query}`);
}

export function createMaintenanceRequest(payload) {
  return apiClient.post('/maintenance/requests', payload);
}

export function fetchMaintenanceRequests() {
  return apiClient.get('/maintenance/requests');
}

export function fetchMaintenanceRequest(requestId) {
  return apiClient.get(`/maintenance/requests/${requestId}`);
}

export function updateMaintenanceRequest(requestId, payload) {
  return apiClient.patch(`/maintenance/requests/${requestId}`, payload);
}

export function addMaintenanceUpdate(requestId, payload) {
  return apiClient.post(`/maintenance/requests/${requestId}/updates`, payload);
}
