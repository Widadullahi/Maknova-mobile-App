const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadClient(kind, url, fetch) {
  const mobile = kind === 'mobile';
  const context = vm.createContext({
    process: { env: mobile ? { EXPO_PUBLIC_API_BASE_URL: url } : { NEXT_PUBLIC_API_BASE_URL: url } },
    fetch, FormData, AbortController, setTimeout, clearTimeout,
    getAccessToken: async () => null, getRefreshToken: async () => null,
    clearTokens: async () => {}, saveTokens: async () => {}, emitSessionExpired: () => {},
  });
  const clean = (source) => source.replace(/^import .*;\r?\n/gm, '')
    .replace(/^export \{.*\};\r?$/gm, '').replace(/^export /gm, '');
  if (mobile) vm.runInContext(clean(fs.readFileSync('src/config/env.js', 'utf8')), context);
  const path = mobile ? 'src/api/client.js' : `${kind}-dashboard/lib/api.js`;
  vm.runInContext(clean(fs.readFileSync(path, 'utf8')) +
    (mobile ? '\nglobalThis.call = (path) => apiClient.get(path);' : '\nglobalThis.call = (path) => apiRequest(path);'), context);
  return context.call;
}

for (const kind of ['mobile', 'admin', 'manager']) {
  test(`${kind}: missing backend URL fails before any network request`, async () => {
    let calls = 0;
    const call = loadClient(kind, '', async () => { calls++; });
    await assert.rejects(call('/auth/me'), /Backend URL is not configured/);
    assert.equal(calls, 0);
  });
  test(`${kind}: configured endpoint is used with trailing slashes normalized`, async () => {
    let actual;
    const call = loadClient(kind, ' https://api.example.invalid/api/v1/// ', async (url) => {
      actual = url;
      return { ok: true, json: async () => ({ data: { ready: true } }) };
    });
    assert.equal((await call('/auth/me')).ready, true);
    assert.equal(actual, 'https://api.example.invalid/api/v1/auth/me');
  });
}
