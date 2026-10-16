import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  registerPushToken,
} from '../api/notifications';
import { useAuth } from './AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Must match the defaultChannel configured for expo-notifications in app.json
// and the channelId the backend sends with every Expo push message.
const ANDROID_CHANNEL_ID = 'estateflow';

async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    // Android 13+: the permissions prompt only appears once at least one
    // notification channel exists, so this MUST run before requesting the token.
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Estate updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
    });
  }
}

async function requestExpoPushToken() {
  await ensureAndroidChannel();

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  // Expo push tokens require the EAS projectId configured in app.json
  // (extra.eas.projectId). Without it we cannot get a token.
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) {
    return null;
  }

  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    // Push is best-effort: emulators without Play services, Expo Go on Android
    // (SDK 53+ needs a dev build), or network failures all land here.
    return null;
  }
}

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const registeredTokenRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setNotifications(data.notifications || []);
    } catch {
      setNotifications((current) => (current.length ? current : []));
    }
  }, []);

  // Load the server-side notification list whenever auth state changes.
  useEffect(() => {
    let mounted = true;

    if (!isAuthenticated) {
      setNotifications([]);
      return () => {
        mounted = false;
      };
    }

    loadNotifications();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user?.id, loadNotifications]);

  // Register the device for remote pushes once per login. Replaces any
  // previously stored token server-side (one device per account).
  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      registeredTokenRef.current = null;
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const token = await requestExpoPushToken();
      if (!token || cancelled) return;
      if (registeredTokenRef.current === token) return;
      try {
        await registerPushToken(token, Platform.OS);
        registeredTokenRef.current = token;
      } catch {
        // Registration failure never blocks the app.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  // A push arriving while the app is open refreshes the in-app list so the
  // notification center screen stays in sync without a manual pull.
  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      if (registeredTokenRef.current) {
        loadNotifications();
      }
    });

    return () => {
      receivedSubscription.remove();
    };
  }, [loadNotifications]);

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

  async function markAllRead() {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })));
    await markAllNotificationsRead().catch(() => null);
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const value = useMemo(
    () => ({ notifications, unreadCount, addInAppNotification, markRead, markAllRead, refresh: loadNotifications }),
    [notifications, unreadCount, addInAppNotification, markAllRead, loadNotifications]
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
