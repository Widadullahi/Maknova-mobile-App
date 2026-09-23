import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { fetchNotifications, markNotificationRead } from '../api/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadNotifications() {
      try {
        const data = await fetchNotifications();
        if (mounted) {
          setNotifications(data.notifications || []);
        }
      } catch {
        if (mounted) {
          setNotifications([]);
        }
      }
    }

    loadNotifications();

    return () => {
      mounted = false;
    };
  }, []);

  async function addInAppNotification({ title, body, type = 'info', data = {} }) {
    const notification = {
      id: `local-${Date.now()}`,
      title,
      body,
      type,
      data,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    setNotifications((current) => [notification, ...current]);

    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: null,
    }).catch(() => null);

    return notification;
  }

  async function markRead(notificationId) {
    setNotifications((current) =>
      current.map((item) => (item.id === notificationId ? { ...item, isRead: true, readAt: new Date().toISOString() } : item))
    );

    if (typeof notificationId === 'number') {
      await markNotificationRead(notificationId).catch(() => null);
    }
  }

  function markAllRead() {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })));
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const value = useMemo(
    () => ({ notifications, unreadCount, addInAppNotification, markRead, markAllRead }),
    [notifications, unreadCount]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error('useNotifications must be used inside NotificationsProvider');
  }

  return context;
}
