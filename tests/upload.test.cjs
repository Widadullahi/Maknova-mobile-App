const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function uploadModule(platform) {
  const source = fs.readFileSync('src/api/upload.js', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export async function uploadMultipart', 'async function uploadMultipart');
  class NativeFile { constructor(uri) { this.uri = uri; } }
  const context = vm.createContext({ Platform: { OS: platform }, ExpoFile: NativeFile, File, Blob, FormData, fetch, console });
  vm.runInContext(source + '\nglobalThis.createUploadFile = createUploadFile;', context);
  return context;
}

test('web camera capture becomes a browser File with bytes and MIME type', async () => {
  const { createUploadFile } = uploadModule('web');
  const result = await createUploadFile({ uri: 'data:image/png;base64,aGVsbG8=', mimeType: 'image/png' }, 'capture');
  assert.ok(result.file instanceof File);
  assert.equal(result.file.name, 'capture.png');
  assert.equal(result.file.type, 'image/png');
  assert.equal(await result.file.text(), 'hello');
});

test('web document picker preserves its File object', async () => {
  const { createUploadFile } = uploadModule('web');
  const file = new File(['document'], 'proof.pdf', { type: 'application/pdf' });
  assert.equal((await createUploadFile({ file }, 'fallback')).file, file);
});

test('Android upload uses Expo File with the selected URI', async () => {
  const { createUploadFile } = uploadModule('android');
  const result = await createUploadFile({ uri: 'file:///capture.jpg', mimeType: 'image/jpeg' }, 'capture');
  assert.equal(result.file.uri, 'file:///capture.jpg');
  assert.equal(result.name, 'capture.jpg');
});

test('invalid assets fail before attempting an upload', async () => {
  const { createUploadFile } = uploadModule('android');
  await assert.rejects(createUploadFile({}, 'capture'), /missing a readable URI/);
});
