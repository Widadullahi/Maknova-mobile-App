import { apiClient } from './client';

export function fetchBuyers(estateId) {
  return apiClient.get(`/estates/${estateId}/buyers`);
}

export function createBuyer(estateId, payload) {
  return apiClient.post(`/estates/${estateId}/buyers`, payload);
}

export function fetchSales(estateId) {
  return apiClient.get(`/estates/${estateId}/sales`);
}

export function createReservation(estateId, payload) {
  return apiClient.post(`/estates/${estateId}/reservations`, payload);
}

export function createSale(estateId, payload) {
  return apiClient.post(`/estates/${estateId}/sales`, payload);
}

export function createAllocation(estateId, payload) {
  return apiClient.post(`/estates/${estateId}/allocations`, payload);
}
