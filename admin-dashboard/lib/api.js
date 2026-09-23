export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://estate.watchup.site/api/v1';

export async function apiRequest(path, options = {}, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Request failed: ${path}`);
  return payload.data || {};
}

export async function login(email, password) {
  // portal: 'admin' is enforced server-side too — a non-admin account (e.g. an
  // estate manager) gets rejected with 403 before any token is issued at all.
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, portal: 'admin' }),
  });
  return { token: data.tokens?.accessToken, tokens: data.tokens, user: data.user };
}

export function arrayFrom(data, ...keys) {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

export function assetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const apiRoot = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${apiRoot}${path.startsWith('/') ? path : `/${path}`}`;
}

// Verification/property documents live in a private vault and require an
// authenticated request. Browsers don't attach Authorization headers to plain
// <img>/<a> tags, so the same JWT is passed as a query param the backend also
// accepts (see JWT_TOKEN_LOCATION) — same credential, same role/ownership checks,
// just a different place to carry it for direct-link use cases.
export function verificationDocumentUrl(document, token, download = false) {
  if (!document?.id) return assetUrl(document?.fileUrl || document?.url);
  const params = new URLSearchParams();
  if (download) params.set('download', '1');
  if (token) params.set('access_token', token);
  const query = params.toString();
  return `${API_BASE_URL}/verification/documents/${document.id}/file${query ? `?${query}` : ''}`;
}

export function propertyDocumentUrl(document, token, download = false) {
  // 'image' documents are public marketing photos, served straight from the
  // public /uploads path — no auth needed, no vault involved. Every other
  // category (title_document, allocation_document, deed_of_assignment) is
  // private and must go through the authenticated vault endpoint.
  if (document?.category === 'image') {
    return assetUrl(document?.fileUrl || document?.url);
  }
  if (!document?.id) return '';
  const params = new URLSearchParams();
  if (download) params.set('download', '1');
  if (token) params.set('access_token', token);
  const query = params.toString();
  return `${API_BASE_URL}/estates/properties/documents/${document.id}/file${query ? `?${query}` : ''}`;
}

export function canPreviewDocument(document) {
  const mimeType = String(document?.mimeType || '').toLowerCase();
  const fileName = String(document?.fileName || '').toLowerCase();
  return mimeType.startsWith('image/') || mimeType === 'application/pdf' || /\.(png|jpe?g|pdf)$/.test(fileName);
}
