import { apiClient } from './client';

export function initializeSalePayment(saleId) {
  return apiClient.post(`/payments/sales/${saleId}/initialize`, {});
}

export function verifySalePayment(reference) {
  return apiClient.get(`/payments/verify/${reference}`);
}

export function fetchPayments(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiClient.get(`/payments${query ? `?${query}` : ''}`);
}

export function fetchPaymentSummary() {
  return apiClient.get('/payments/summary');
}

export function fetchInstallmentPlan(saleId) {
  return apiClient.get(`/installments/sales/${saleId}`);
}

export function listInstallmentPlans() {
  return apiClient.get('/installments');
}

export function initializeInstallmentPayment(installmentId) {
  return apiClient.post(`/installments/${installmentId}/initialize`, {});
}
