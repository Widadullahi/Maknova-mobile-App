'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const TOKEN_KEY = 'ef_manager_token';
const USER_KEY = 'ef_manager_user';

// Only estate_manager accounts may use this portal. Admin/super_admin, buyers,
// residents, and security have their own surfaces and are never granted access here.
export const ALLOWED_DASHBOARD_ROLES = ['estate_manager'];

export function saveSession(token, user) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getStoredSession() {
  if (typeof window === 'undefined') return { token: null, user: null };
  const token = window.localStorage.getItem(TOKEN_KEY);
  const rawUser = window.localStorage.getItem(USER_KEY);
  let user = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    user = null;
  }
  return { token, user };
}

export function isDashboardRole(role) {
  return ALLOWED_DASHBOARD_ROLES.includes(String(role || '').toLowerCase());
}

/**
 * Client-side guard for every /dashboard/* page. Redirects to /login when there is
 * no session, or when the signed-in account is not an estate manager.
 */
export function useManagerSession() {
  const router = useRouter();
  const [session, setSession] = useState({ token: null, user: null, status: 'loading' });

  useEffect(() => {
    const stored = getStoredSession();
    if (!stored.token || !stored.user || !isDashboardRole(stored.user.role)) {
      clearSession();
      router.replace('/login');
      setSession({ token: null, user: null, status: 'unauthenticated' });
      return;
    }
    setSession({ token: stored.token, user: stored.user, status: 'ready' });
  }, [router]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  function updateUser(nextUser) {
    saveSession(session.token, nextUser);
    setSession((current) => ({ ...current, user: nextUser }));
  }

  return { ...session, logout, updateUser };
}
