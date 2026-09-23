import { apiClient } from './client';

export function fetchResidents(estateId) {
  return apiClient.get(`/estates/${estateId}/residents`);
}

export function createResident(estateId, payload) {
  return apiClient.post(`/estates/${estateId}/residents`, payload);
}

export function updateResidentStatus(estateId, residentId, payload) {
  return apiClient.patch(`/estates/${estateId}/residents/${residentId}/status`, payload);
}
