import { apiClient } from './client';

export function fetchAnalyticsSummary() {
  return apiClient.get('/analytics/summary');
}

export function fetchVisitorHistory() {
  return apiClient.get('/analytics/visitor-history');
}

export function exportAnalytics(reportType, format = 'json') {
  return apiClient.get(`/analytics/exports/${reportType}?format=${encodeURIComponent(format)}`);
}
