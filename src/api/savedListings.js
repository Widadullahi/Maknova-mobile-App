import { apiClient } from './client';

export function fetchSavedListings() {
  return apiClient.get('/saved-listings');
}

export function saveListing(propertyId) {
  return apiClient.post(`/saved-listings/${propertyId}`, {});
}

export function unsaveListing(propertyId) {
  return apiClient.delete(`/saved-listings/${propertyId}`);
}
