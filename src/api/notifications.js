import { apiClient } from './client';

export function fetchNotifications() {
  return apiClient.get('/notifications');
}

export function markNotificationRead(notificationId) {
  return apiClient.patch(`/notifications/${notificationId}/read`, {});
}
