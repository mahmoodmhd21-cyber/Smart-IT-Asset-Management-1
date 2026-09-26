const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(process.env.QA_APP_ROOT || path.join(__dirname, '..'));
const dependency = name => require(path.join(root, 'node_modules', name));
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const express = dependency('express');
const mongoose = dependency('mongoose');
const bcrypt = dependency('bcryptjs');
const jwt = dependency('jsonwebtoken');
const User = require(path.join(root, 'models/User'));
const Employee = require(path.join(root, 'models/Employee'));
const database = `smart_it_auth_test_${Date.now()}_${process.pid}`;
const password = randomBytes(20).toString('hex');
const missingId = '000000000000000000000099';

test('Access control with real HTTP routes and disposable MongoDB', { timeout: 90000 }, async t => {
  let server;
  let browser;
  let mongo;
  try {
    // This test never reads .env or uses an existing application database.
    mongo = await require('./qa/mongo-fixture.cjs').startMongo();
    await mongoose.connect(mongo.uri(database), { serverSelectionTimeoutMS: 3000 });
    await t.test('Local bootstrap creates one Admin and refuses a second run', async () => {
      const env = { ...process.env, MONGO_URI: mongo.uri(database),
        BOOTSTRAP_ADMIN_NAME: 'First Admin', BOOTSTRAP_ADMIN_EMAIL: 'first@example.test', BOOTSTRAP_ADMIN_PASSWORD: password };
      const run = () => spawnSync(process.execPath, [path.join(root, 'scripts/bootstrap-admin.js')], { cwd: root, env, timeout: 10000 });
      assert.equal(run().status, 0);
      assert.equal(run().status, 1);
      assert.equal(await User.countDocuments({ role: 'Admin' }), 1);
    });
    const hash = await bcrypt.hash(password, 10);
    const admin = await User.create({ fullName: 'Security Admin', email: 'admin@example.test', password: hash, role: 'Admin' });
    const staff = await User.create({ fullName: 'Security Staff', email: 'staff@example.test', password: hash, role: 'IT Staff' });
    const employee = await Employee.create({ fullName: staff.fullName, email: 'employee@example.test', employeeId: 'SEC-1', department: 'IT', designation: 'Technician' });
    const app = express();
    app.use(express.json());
    for (const [prefix, file] of Object.entries({ auth: 'auth', assets: 'asset', allocations: 'allocation', employees: 'employee', licenses: 'license', maintenance: 'maintenance', qr: 'qrCode' })) {
      app.use(`/api/${prefix}`, require(path.join(root, `routes/${file}Routes`)));
    }
    app.use(express.static(path.join(root, 'frontend/dist')));
    app.get('*', (req, res) => res.sendFile(path.join(root, 'frontend/dist/index.html')));
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function api(method, url, token, body) {
      const response = await fetch(`${origin}/api${url}`, {
        method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000),
      });
      return { status: response.status, body: await response.json().catch(() => ({})) };
    }
    const login = email => api('POST', '/auth/login', null, { email, password });
    const adminToken = (await login(admin.email)).body.token;
    let staffToken = (await login(staff.email)).body.token;
    assert.ok(adminToken && staffToken);

    const endpoints = [];
    for (const module of ['assets', 'allocations', 'employees', 'licenses', 'maintenance']) {
      endpoints.push(['GET', `/${module}`], ['POST', `/${module}`], ['GET', `/${module}/${missingId}`], ['DELETE', `/${module}/${missingId}`]);
      endpoints.push(module === 'allocations' ? ['PATCH', `/allocations/${missingId}/return`] : ['PUT', `/${module}/${missingId}`]);
    }
    endpoints.push(['POST', '/auth/register'], ['GET', '/auth/users'], ['GET', '/auth/assignees'], ['GET', '/auth/me'], ['PATCH', `/auth/users/${staff.id}/access`],
      ['GET', '/qr'], ['POST', '/qr/scan'], ['PATCH', '/qr/status'], ['GET', '/qr/resolve/token'], ['POST', `/qr/assets/${missingId}/generate`], ['GET', `/qr/assets/${missingId}/image`]);
    for (const [method, url] of endpoints) {
      await t.test(`anonymous ${method} ${url} is 401`, async () => assert.equal((await api(method, url, null, method === 'GET' ? undefined : {})).status, 401));
    }
    for (const [method, url] of endpoints.filter(([, url]) => url.startsWith('/employees') || url === '/auth/register' || url === '/auth/users' || url.endsWith('/access'))) {
      await t.test(`IT Staff ${method} ${url} is 403`, async () => assert.equal((await api(method, url, staffToken, method === 'GET' ? undefined : {})).status, 403));
    }
    for (const role of ['Admin', 'IT Staff']) {
      const token = role === 'Admin' ? adminToken : staffToken;
      for (const url of ['/assets', '/allocations', '/licenses', '/maintenance', '/qr', '/auth/me', '/auth/assignees']) {
        await t.test(`${role} can read ${url}`, async () => assert.equal((await api('GET', url, token)).status, 200));
      }
    }
    await t.test('Admin provisioning validates roles and ignores security fields', async () => {
      assert.equal((await api('POST', '/auth/register', adminToken, { fullName: 'Invalid', email: 'invalid@example.test', password, role: 'Owner' })).status, 400);
      for (const role of ['Admin', 'IT Staff']) {
        const result = await api('POST', '/auth/register', adminToken, { fullName: role, email: `new-${role.replace(' ', '')}@example.test`, password, role, tokenVersion: 99, isActive: false });
        assert.equal(result.status, 201);
        assert.equal(result.body.user.isActive, true);
        assert.equal(result.body.user.password, undefined);
      }
    });
    await t.test('Missing, short and known fallback secrets fail closed', () => {
      for (const secret of ['', 'short', 'dev-jwt-secret']) {
        const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(root, 'config/auth'))})`], { env: { ...process.env, JWT_SECRET: secret }, timeout: 5000 });
        assert.equal(result.status, 1);
      }
    });
    await t.test('Invalid, expired, legacy, wrong-secret and unsupported-algorithm tokens fail', async () => {
      const payload = { userId: staff.id, role: 'Admin', tokenVersion: 0 };
      const tokens = ['invalid', jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: -1 }),
        jwt.sign({ userId: staff.id }, process.env.JWT_SECRET), jwt.sign(payload, 'wrong-secret'),
        jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS384' })];
      for (const token of tokens) assert.equal((await api('GET', '/assets', token)).status, 401);
      const forgedRole = jwt.sign(payload, process.env.JWT_SECRET);
      assert.equal((await api('GET', '/auth/users', forgedRole)).status, 403);
    });
    await t.test('Existing accounts without new fields can log in', async () => {
      await User.collection.insertOne({ fullName: 'Legacy', email: 'legacy@example.test', password: hash, role: 'IT Staff' });
      const legacy = await login('legacy@example.test');
      assert.equal(legacy.status, 200);
      assert.equal((await api('GET', '/auth/me', legacy.body.token)).status, 200);
    });
    await t.test('Revocation, disable and enable do not resurrect old sessions', async () => {
      const endpoint = `/auth/users/${staff.id}/access`;
      assert.equal((await api('PATCH', endpoint, adminToken, { revokeSessions: true })).status, 200);
      assert.equal((await api('GET', '/assets', staffToken)).status, 401);
      staffToken = (await login(staff.email)).body.token;
      assert.equal((await api('GET', '/assets', staffToken)).status, 200);
      assert.equal((await api('PATCH', endpoint, adminToken, { isActive: false })).status, 200);
      assert.equal((await login(staff.email)).status, 401);
      for (const [method, url] of endpoints) {
        assert.equal((await api(method, url, staffToken, method === 'GET' ? undefined : {})).status, 401);
      }
      assert.ok(!(await api('GET', '/auth/assignees', adminToken)).body.some(user => user.id === staff.id));
      assert.equal((await api('PATCH', endpoint, adminToken, { isActive: true })).status, 200);
      assert.equal((await api('GET', '/assets', staffToken)).status, 401);
      staffToken = (await login(staff.email)).body.token;
      assert.equal((await api('GET', '/assets', staffToken)).status, 200);
    });
    await t.test('Access payload, IDs and self-lockout are guarded', async () => {
      for (const body of [{}, { isActive: 'false' }, { role: 'Admin' }, { revokeSessions: false }, { isActive: true, tokenVersion: 0 }]) {
        assert.equal((await api('PATCH', `/auth/users/${staff.id}/access`, adminToken, body)).status, 400);
      }
      assert.equal((await api('PATCH', `/auth/users/${admin.id}/access`, adminToken, { isActive: false })).status, 409);
      assert.equal((await api('PATCH', '/auth/users/invalid/access', adminToken, { isActive: false })).status, 400);
      assert.equal((await api('PATCH', `/auth/users/${missingId}/access`, adminToken, { isActive: false })).status, 404);
    });
    await t.test('Concurrent revocations all invalidate a token', async () => {
      const before = await User.findById(staff.id);
      const responses = await Promise.all(Array.from({ length: 5 }, () => api('PATCH', `/auth/users/${staff.id}/access`, adminToken, { revokeSessions: true })));
      assert.ok(responses.every(response => response.status === 200));
      assert.equal((await User.findById(staff.id)).tokenVersion, before.tokenVersion + 5);
      assert.equal((await api('GET', '/assets', staffToken)).status, 401);
      staffToken = (await login(staff.email)).body.token;
    });
    await t.test('Role changes and deleted accounts take effect immediately', async () => {
      const temporary = await User.create({ fullName: 'Temporary', email: 'temp@example.test', password: hash, role: 'Admin' });
      const token = (await login(temporary.email)).body.token;
      assert.equal((await api('GET', '/auth/users', token)).status, 200);
      await User.findByIdAndUpdate(temporary.id, { role: 'IT Staff' });
      assert.equal((await api('GET', '/auth/users', token)).status, 403);
      await User.findByIdAndDelete(temporary.id);
      assert.equal((await api('GET', '/assets', token)).status, 401);
    });
    let device;
    await t.test('Staff CRUD, allocation and private QR image remain usable', async () => {
      const created = await api('POST', '/assets', staffToken, { assetName: 'Security test device', status: 'Available' });
      assert.equal(created.status, 201);
      device = created.body.data;
      assert.equal((await api('PUT', `/assets/${device._id}`, staffToken, { location: 'QA Lab' })).status, 200);
      const allocated = await api('POST', '/allocations', staffToken, { assetId: device._id, employeeId: employee.id });
      assert.equal(allocated.status, 201);
      for (const url of ['/allocations', `/allocations/${allocated.body.data._id}`]) {
        const result = await api('GET', url, staffToken);
        assert.equal(result.status, 200);
        assert.ok(!JSON.stringify(result.body).includes(hash));
        assert.ok(!JSON.stringify(result.body).includes('tokenVersion'));
      }
      assert.equal((await api('PATCH', `/allocations/${allocated.body.data._id}/return`, staffToken, {})).status, 200);
      const image = await fetch(`${origin}/api/qr/assets/${device._id}/image`, { headers: { Authorization: `Bearer ${staffToken}` } });
      assert.equal(image.status, 200);
      assert.match(image.headers.get('content-type'), /image\/png/);
    });
    if (process.env.QA_BROWSER === '1') {
      await t.test('Browser login, staff allocation options, private QR preview/download and admin revocation', async () => {
        const { chromium } = require(process.env.QA_PLAYWRIGHT || 'playwright');
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin);
        await page.locator('input[name=email]').fill(staff.email);
        await page.locator('input[name=password]').fill(password);
        await page.locator('button[type=submit]').click();
        await page.waitForURL('**/dashboard');
        await page.goto(`${origin}/allocations`);
        await page.getByRole('button', { name: /New Allocation/ }).click();
        await page.locator('select[name=employee] option').filter({ hasText: staff.fullName }).waitFor({ state: 'attached' });
        await page.goto(`${origin}/qr-codes`);
        await page.waitForFunction(() => [...document.images].some(image => image.src.startsWith('blob:') && image.naturalWidth > 0));
        const downloaded = page.waitForEvent('download');
        await page.getByRole('link', { name: 'Download PNG' }).click();
        assert.match((await downloaded).suggestedFilename(), /\.png$/);
        const activeToken = await page.evaluate(() => localStorage.getItem('authToken'));
        await page.goto(origin);
        await page.locator('input[name=email]').fill(admin.email);
        await page.locator('input[name=password]').fill(password);
        await page.locator('button[type=submit]').click();
        await page.waitForURL('**/dashboard');
        await page.goto(`${origin}/users`);
        page.on('dialog', dialog => dialog.accept());
        await page.getByRole('button', { name: `Disable ${staff.fullName}`, exact: true }).click();
        await page.getByRole('button', { name: `Enable ${staff.fullName}`, exact: true }).waitFor();
        assert.equal((await api('GET', '/assets', activeToken)).status, 401);
        assert.equal((await login(staff.email)).status, 401);
        await page.getByRole('button', { name: `Enable ${staff.fullName}`, exact: true }).click();
        await page.getByRole('button', { name: `Disable ${staff.fullName}`, exact: true }).waitFor();
        const renewed = (await login(staff.email)).body.token;
        await page.getByRole('button', { name: `Revoke sessions for ${staff.fullName}`, exact: true }).click();
        await page.getByText(`Account access updated for ${staff.fullName}.`, { exact: true }).waitFor();
        assert.equal((await api('GET', '/assets', renewed)).status, 401);
        assert.deepEqual(errors, []);
      });
    }
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === database) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  }
});
