import { API_BASE_URL } from '../config/env';
import { emitSessionExpired } from '../services/sessionEvents';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../services/tokenStorage';

// Access tokens are short-lived (30 min) — a long-running screen (e.g. filling out
// the verification form) will outlive one. `refreshInFlight` dedupes concurrent
// 401s during that window into a single refresh call instead of one per request.
let refreshInFlight = null;

async function fetchWithTimeout(url, options = {}) {
  if (!API_BASE_URL) throw new Error('Backend URL is not configured. Set EXPO_PUBLIC_API_BASE_URL to the deployed AWS API URL.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The server took too long to respond. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;

      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Bearer ${refreshToken}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return null;

        const tokens = payload?.data?.tokens;
        if (!tokens?.accessToken) return null;

        await saveTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken || refreshToken });
        return tokens.accessToken;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request(path, options = {}, { isRetry = false } = {}) {
  const token = await getAccessToken();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Expired/invalid access token: try a silent refresh-and-retry once before
    // giving up. Never retry the refresh endpoint itself or a request that's
    // already been retried, and never treat a 401 on an *unauthenticated*
    // request (e.g. login/register with bad credentials) as session expiry.
    if (response.status === 401 && token && !isRetry && path !== '/auth/refresh') {
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        return request(path, options, { isRetry: true });
      }
      await clearTokens();
      emitSessionExpired();
      throw Object.assign(new Error('Your session has expired. Please log in again.'), { status: 401, code: 'SESSION_EXPIRED' });
    }

    const message = payload?.error?.message || payload?.msg || 'Something went wrong';
    const apiError = new Error(message);
    apiError.code = payload?.error?.code;
    apiError.details = payload?.error?.details || {};
    apiError.status = response.status;
    throw apiError;
  }

  return payload.data;
}

export const apiClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path, body) => request(path, { method: 'DELETE', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
};

export { refreshAccessToken };
