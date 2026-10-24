import { fetch as expoFetch } from 'expo/fetch';
import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';
import { refreshAccessToken } from './client';
import { API_BASE_URL } from '../config/env';
import { clearTokens, getAccessToken } from '../services/tokenStorage';
import { emitSessionExpired } from '../services/sessionEvents';

function normalizeFileName(asset, fallbackName) {
  const rawName = asset?.name || asset?.fileName || fallbackName;
  if (/\.[a-z0-9]+$/i.test(rawName)) return rawName;

  const extensionByMime = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-m4v': 'm4v',
    'video/3gpp': '3gp',
  };
  const extension = extensionByMime[asset?.mimeType] || 'bin';
  return `${rawName}.${extension}`;
}

async function createUploadFile(asset, fallbackName) {
  if (Platform.OS === 'web') {
    // expo-file-system is an unsupported stub on web. expo-document-picker hands
    // us a real DOM File (asset.file), while camera captures produce data-URIs —
    // fetch-decoded into a DOM File so FormData can carry a properly typed blob.
    if (asset.file) {
      return { file: asset.file, name: asset.file.name || normalizeFileName(asset, fallbackName) };
    }
    if (asset.uri) {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const name = normalizeFileName(asset, fallbackName);
      return { file: new globalThis.File([blob], name, { type: asset.mimeType || blob.type || 'application/octet-stream' }), name };
    }
  }

  if (!asset?.uri && !asset?.file) {
    throw new Error('Selected file is missing a readable URI.');
  }

  const name = normalizeFileName(asset, fallbackName);
  return {
    file: new ExpoFile(asset.uri),
    name,
  };
}

async function postMultipart(path, form, token) {
  if (!API_BASE_URL) throw new Error('Backend URL is not configured. Set EXPO_PUBLIC_API_BASE_URL to the deployed AWS API URL.');
  const response = await expoFetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function buildForm(assets, category, fallbackName) {
  const form = new FormData();
  form.append('category', category);
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const uploadFile = await createUploadFile(asset, `${fallbackName}-${index + 1}`);
    form.append('files', uploadFile.file, uploadFile.name);
    // Anti-fraud capture metadata for property media (image/video categories).
    // The backend rejects media without a camera source + fresh capturedAt.
    if (asset.source) form.append(`sources[${index}]`, asset.source);
    if (asset.capturedAt) form.append(`capturedAts[${index}]`, asset.capturedAt);
    if (asset.mediaKind) form.append(`mediaKinds[${index}]`, asset.mediaKind);
  }
  return form;
}

export async function uploadMultipart(path, { assets, category, fallbackName, failureMessage }) {
  const token = await getAccessToken();

  let { response, payload } = await postMultipart(path, await buildForm(assets, category, fallbackName), token);

  // Same expired-access-token story as apiClient: a document upload can easily
  // happen after the 30-min access token has died, so retry once with a
  // refreshed token before surfacing an error. A fresh FormData/File pair is
  // built for the retry since the first body's file stream may already be spent.
  if (!response.ok && response.status === 401) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      ({ response, payload } = await postMultipart(path, await buildForm(assets, category, fallbackName), newAccessToken));
    } else {
      await clearTokens();
      emitSessionExpired();
      throw Object.assign(new Error('Your session has expired. Please log in again.'), { status: 401, code: 'SESSION_EXPIRED' });
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.msg || failureMessage || 'Upload failed');
  }

  return payload.data;
}
