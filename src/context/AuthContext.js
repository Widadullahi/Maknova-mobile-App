import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUser, loginUser, registerUser } from '../api/auth';
import { onSessionExpired } from '../services/sessionEvents';
import { clearTokens, saveTokens } from '../services/tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isBooting, setIsBooting] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const currentUser = await fetchCurrentUser();
        if (mounted) {
          setUser(currentUser.user);
        }
      } catch {
        await clearTokens();
      } finally {
        if (mounted) {
          setIsBooting(false);
        }
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // apiClient/uploadMultipart emit this once a refresh attempt has already
    // failed (refresh token itself expired/revoked) — the only thing left to
    // do is drop the stale user and let the navigator send them back to login.
    return onSessionExpired(() => {
      setUser(null);
      setAuthError('Your session has expired. Please log in again.');
    });
  }, []);

  async function login(credentials, { rememberMe = true } = {}) {
    setAuthError(null);
    const data = await loginUser(credentials);
    await saveTokens(data.tokens, { persist: rememberMe });
    setUser(data.user);
  }

  async function register(payload) {
    setAuthError(null);
    const data = await registerUser(payload);
    await saveTokens(data.tokens);
    setUser(data.user);
  }

  async function logout() {
    await clearTokens();
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      isBooting,
      authError,
      setAuthError,
      login,
      register,
      logout,
      isAuthenticated: Boolean(user),
    }),
    [user, isBooting, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
