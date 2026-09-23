import { apiClient } from './client';
import { uploadMultipart } from './upload';

export function fetchEstates() {
  return apiClient.get('/estates');
}

export function createEstate(payload) {
  return apiClient.post('/estates', payload);
}

export function fetchEstateProperties(estateId, filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  const query = params.toString();
  return apiClient.get(`/estates/${estateId}/properties${query ? `?${query}` : ''}`);
}

export function fetchPublicProperties(filters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  const query = params.toString();
  return apiClient.get(`/estates/public/properties${query ? `?${query}` : ''}`);
}

export function createProperty(estateId, payload) {
  return apiClient.post(`/estates/${estateId}/properties`, payload);
}

export function updatePropertyStatus(estateId, propertyId, payload) {
  return apiClient.patch(`/estates/${estateId}/properties/${propertyId}/status`, payload);
}

export function updatePropertyFields(estateId, propertyId, payload) {
  return apiClient.patch(`/estates/${estateId}/properties/${propertyId}`, { ...payload, confirm: true });
}

export function fetchPropertyDocuments(estateId, propertyId) {
  return apiClient.get(`/estates/${estateId}/properties/${propertyId}/documents`);
}

export function addPropertyDocument(estateId, propertyId, payload) {
  return apiClient.post(`/estates/${estateId}/properties/${propertyId}/documents`, payload);
}

export async function uploadPropertyDocuments(estateId, propertyId, category, assets) {
  return uploadMultipart(`/estates/${estateId}/properties/${propertyId}/documents/upload`, {
    assets,
    category,
    fallbackName: 'property-document',
    failureMessage: 'Document upload failed',
  });
}

export function fetchMyPurchases() {
  return apiClient.get('/estates/my/purchases');
}
