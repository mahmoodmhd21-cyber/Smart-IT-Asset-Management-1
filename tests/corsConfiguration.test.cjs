const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

// Exercise the real middleware without connecting to any application database.
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.MONGO_URI = '';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = ' http://localhost:3000/ , https://frontend.example.test/// ';
const root = path.resolve(process.env.QA_APP_ROOT || path.join(__dirname, '..'));
const app = require(path.join(root, 'server.js'));

test('CORS accepts normalized exact origins without weakening API authentication', async () => {
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}/api/auth/login`;
    for (const origin of ['http://localhost:3000', 'https://frontend.example.test']) {
      const response = await fetch(endpoint, { method: 'OPTIONS', headers: {
        Origin: origin, 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization',
      } });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
    }
    for (const origin of ['https://untrusted.example.test', 'https://frontend.example.test.attacker.test', 'http://localhost:5173']) {
      const response = await fetch(endpoint, { method: 'OPTIONS', headers: {
        Origin: origin, 'Access-Control-Request-Method': 'POST',
      } });
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    }
    const privateResponse = await fetch(endpoint.replace('/login', '/me'), {
      headers: { Origin: 'https://frontend.example.test' },
    });
    assert.equal(privateResponse.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
