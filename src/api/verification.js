import { apiClient } from './client';
import { uploadMultipart } from './upload';

export function fetchMyVerificationApplication() {
  return apiClient.get('/verification/me');
}

export function saveVerificationApplication(payload) {
  return apiClient.post('/verification/applications', payload);
}

export function addVerificationDocument(applicationId, payload) {
  return apiClient.post(`/verification/applications/${applicationId}/documents`, payload);
}

export async function uploadVerificationDocuments(applicationId, category, assets) {
  return uploadMultipart(`/verification/applications/${applicationId}/documents/upload`, {
    assets,
    category,
    fallbackName: 'verification-upload',
    failureMessage: 'Upload failed',
  });
}

export function submitVerificationApplication(applicationId) {
  return apiClient.post(`/verification/applications/${applicationId}/submit`, {});
}
