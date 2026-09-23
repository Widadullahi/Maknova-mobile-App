import { apiClient } from './client';

export function createEstateReport(payload) {
  return apiClient.post('/reports', payload);
}

export function fetchEstateReports(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiClient.get(`/reports${query}`);
}

export function updateEstateReportStatus(reportId, payload) {
  return apiClient.patch(`/reports/${reportId}/status`, payload);
}
