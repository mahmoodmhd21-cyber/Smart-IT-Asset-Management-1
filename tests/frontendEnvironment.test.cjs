const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(process.env.QA_APP_ROOT || path.join(__dirname, '..'));
const ts = require(path.join(root, 'frontend/node_modules/typescript'));

for (const [configured, expected] of [
  [undefined, '/api'],
  ['', '/api'],
  [' https://smart-it-asset-api.onrender.com/// ', 'https://smart-it-asset-api.onrender.com/api'],
]) {
  test(`public backend URL routes JSON and QR requests: ${configured || 'same origin'}`, async () => {
    // Substitute Vite's build-time value and mock I/O; never read private environment files.
    const source = fs.readFileSync(path.join(root, 'frontend/src/lib/api.ts'), 'utf8')
      .replaceAll('import.meta.env', JSON.stringify({ VITE_BACKEND_URL: configured }));
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const calls = [];
    const exports = {};
    vm.runInNewContext(code, {
      exports,
      require: () => ({ clearSession() {}, handleUnauthorized() {} }),
      window: {}, localStorage: { getItem: () => 'test-token' },
      URL: { createObjectURL: () => 'blob:test' },
      fetch: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, status: 200, json: async () => ({}), blob: async () => ({}) };
      },
    });
    await exports.auth.login('test@example.test', 'test-password');
    assert.equal(await exports.qrCodes.image('device'), 'blob:test');
    assert.equal(calls[0].url, `${expected}/auth/login`);
    assert.equal(calls[1].url, `${expected}/qr/assets/device/image`);
    assert.equal(calls[1].options.headers.Authorization, 'Bearer test-token');
  });
}
