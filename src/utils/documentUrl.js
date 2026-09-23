import { API_BASE_URL } from '../config/env';
import { getAccessToken } from '../services/tokenStorage';

/**
 * Resolves an openable URL for a property document. 'image' documents are public
 * marketing photos served straight from the API's static /uploads path. Every
 * other category (title_document, allocation_document, deed_of_assignment) is
 * private and must be fetched through the authenticated vault endpoint — the
 * access token is appended as a query param since Linking.openURL can't attach an
 * Authorization header.
 */
export async function resolvePropertyDocumentUrl(doc) {
  if (doc?.category === 'image') {
    if (!doc?.fileUrl) return null;
    if (/^https?:\/\//i.test(doc.fileUrl)) return doc.fileUrl;
    const apiRoot = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    return `${apiRoot}${doc.fileUrl.startsWith('/') ? doc.fileUrl : `/${doc.fileUrl}`}`;
  }

  if (!doc?.id) return null;
  const token = await getAccessToken();
  const params = new URLSearchParams({ download: '1' });
  if (token) params.set('access_token', token);
  return `${API_BASE_URL}/estates/properties/documents/${doc.id}/file?${params.toString()}`;
}
