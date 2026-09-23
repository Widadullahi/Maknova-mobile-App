import { apiClient } from './client';

export function fetchFormTemplates() {
  return apiClient.get('/forms/templates');
}

export function fetchFormSubmissions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.estateId) params.append('estateId', filters.estateId);
  const query = params.toString();
  return apiClient.get(`/forms/submissions${query ? `?${query}` : ''}`);
}

export function submitDigitalForm(payload) {
  return apiClient.post('/forms/submissions', payload);
}

export function initializeDocumentPayment(templateCode, propertyId) {
  return apiClient.post('/forms/document-payments/initialize', { templateCode, propertyId });
}

export function verifyDocumentPayment(reference) {
  return apiClient.get(`/forms/document-payments/verify/${reference}`);
}
