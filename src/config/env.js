// Set the deployed AWS API URL at build time; never fall back to another host.
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');
