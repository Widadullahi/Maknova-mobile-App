import { apiClient } from './client';

export function fetchConversations() {
  return apiClient.get('/communication/conversations');
}

export function createConversation(payload) {
  return apiClient.post('/communication/conversations', payload);
}

export function fetchConversationMessages(conversationId) {
  return apiClient.get(`/communication/conversations/${conversationId}/messages`);
}

export function sendConversationMessage(conversationId, body) {
  return apiClient.post(`/communication/conversations/${conversationId}/messages`, { body });
}

export function markConversationRead(conversationId) {
  return apiClient.patch(`/communication/conversations/${conversationId}/read`, {});
}

export function fetchContacts() {
  return apiClient.get('/communication/contacts');
}

export function fetchGroups(estateId) {
  const query = estateId ? `?estateId=${estateId}` : '';
  return apiClient.get(`/communication/groups${query}`);
}

export function fetchGroupMessages(estateId, groupKey) {
  return apiClient.get(`/communication/groups/${estateId}/${groupKey}/messages`);
}

export function sendGroupMessage(estateId, groupKey, body) {
  return apiClient.post(`/communication/groups/${estateId}/${groupKey}/messages`, { body });
}

export function fetchAnnouncements(estateId) {
  const query = estateId ? `?estateId=${estateId}` : '';
  return apiClient.get(`/communication/announcements${query}`);
}

export function createAnnouncement(payload) {
  return apiClient.post('/communication/announcements', payload);
}

export function acknowledgeAnnouncement(announcementId) {
  return apiClient.post(`/communication/announcements/${announcementId}/acknowledge`, {});
}
