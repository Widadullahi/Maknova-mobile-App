import { apiClient } from './client';

export function fetchNotifications() {
  return apiClient.get('/notifications');
}

export function markNotificationRead(notificationId) {
  return apiClient.patch(`/notifications/${notificationId}/read`, {});
}

export function markAllNotificationsRead() {
  return apiClient.patch('/notifications/read-all', {});
}

export function registerPushToken(token, platform) {
  return apiClient.post('/notifications/push-token', { token, platform });
}

export function deletePushToken() {
  return apiClient.delete('/notifications/push-token');
}
