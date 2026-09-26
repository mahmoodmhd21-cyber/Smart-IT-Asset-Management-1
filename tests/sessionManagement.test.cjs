const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const root = path.resolve(process.env.QA_APP_ROOT || path.join(__dirname, '..'));
const dependency = name => require(path.join(root, 'node_modules', name));
const mongoose = dependency('mongoose'), express = dependency('express'), bcrypt = dependency('bcryptjs');
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const User = require(path.join(root, 'models/User'));
const Asset = require(path.join(root, 'models/Asset'));
const { startMongo } = require('./qa/mongo-fixture.cjs');

test('Step 5 sessions, feedback, management and serial numbers', { timeout: 180000 }, async t => {
  let mongo, server, browser;
  try {
    mongo = await startMongo();
    await mongoose.connect(mongo.uri(`smart_it_step5_${Date.now()}`));
    const password = randomBytes(20).toString('hex');
    const hash = await bcrypt.hash(password, 10);
    const admin = await User.create({ fullName: 'Session Admin', email: 'admin@example.test', role: 'Admin', password: hash });
    const staff = await User.create({ fullName: 'Session Staff', email: 'staff@example.test', role: 'IT Staff', password: hash });
    await Asset.init();
    const app = express(); app.use(express.json());
    for (const [prefix, file] of Object.entries({ auth: 'auth', assets: 'asset', employees: 'employee', allocations: 'allocation', licenses: 'license', maintenance: 'maintenance', qr: 'qrCode' })) {
      app.use(`/api/${prefix}`, require(path.join(root, `routes/${file}Routes`)));
    }
    app.use(express.static(path.join(root, 'frontend/dist'), { redirect: false }));
    app.get('*', (_, res) => res.sendFile(path.join(root, 'frontend/dist/index.html')));
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    let token;
    async function api(method, url, body, credential = token) {
      const response = await fetch(origin + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      return { status: response.status, body: await response.json() };
    }
    const login = async email => (await api('POST', '/auth/login', { email, password }, null)).body.token;
    token = await login(admin.email);
    const staffToken = await login(staff.email);
    const expect = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result.body)); return result.body.data; };
    let counter = 0;
    const asset = async serial => expect(await api('POST', '/assets', { assetName: `Step5 asset ${++counter}`, ...(serial === undefined ? {} : { serialNumber: serial }) }), 201);
    const employee = async () => expect(await api('POST', '/employees', { fullName: `Step5 employee ${++counter}`, employeeId: `S5-${counter}`, email: `person${counter}@example.test`, department: 'IT', designation: 'Technician' }), 201);

    await t.test('serials persist, trim, search contract and blank historical values remain optional', async () => {
      const saved = await asset(' Serial-Alpha ');
      assert.equal(saved.serialNumber, 'Serial-Alpha');
      assert.equal(expect(await api('GET', `/assets/${saved._id}`)).serialNumber, 'Serial-Alpha');
      expect(await api('PUT', `/assets/${saved._id}`, { serialNumber: 'Serial-Beta' }));
      assert.equal(expect(await api('GET', '/assets')).find(a => a._id === saved._id).serialNumber, 'Serial-Beta');
      await asset(); await asset(''); await asset('   ');
      expect(await api('PUT', `/assets/${saved._id}`, { serialNumber: '' }));
      assert.equal(expect(await api('GET', `/assets/${saved._id}`)).serialNumber, undefined);
      for (const serialNumber of [42, {}, 'x'.repeat(121)]) expect(await api('POST', '/assets', { assetName: 'Invalid serial', serialNumber }), 400);
    });
    await t.test('database serial uniqueness covers case, edits and concurrent creates', async () => {
      const first = await asset('Unique-Serial'); const second = await asset();
      expect(await api('POST', '/assets', { assetName: 'Duplicate', serialNumber: 'unique-serial' }), 409);
      expect(await api('PUT', `/assets/${second._id}`, { serialNumber: ' UNIQUE-SERIAL ' }), 409);
      assert.equal(expect(await api('GET', `/assets/${first._id}`)).serialNumber, 'Unique-Serial');
      const results = await Promise.all(Array.from({ length: 5 }, () => api('POST', '/assets', { assetName: 'Concurrent serial', serialNumber: 'RACE-SERIAL' })));
      assert.equal(results.filter(r => r.status === 201).length, 1);
      assert.equal(results.filter(r => r.status === 409).length, 4);
    });
    await t.test('account edits require Admin, reject unsafe fields/self edits and revoke sessions', async () => {
      expect(await api('PATCH', `/auth/users/${staff.id}`, { fullName: 'No' }, null), 401);
      expect(await api('PATCH', `/auth/users/${admin.id}`, { fullName: 'No' }, staffToken), 403);
      expect(await api('PATCH', `/auth/users/${admin.id}`, { role: 'IT Staff' }), 409);
      expect(await api('PATCH', `/auth/users/${admin.id.toUpperCase()}`, { role: 'IT Staff' }), 409);
      expect(await api('PATCH', `/auth/users/${admin.id.toUpperCase()}/access`, { isActive: false }), 409);
      for (const body of [{ role: 'Owner' }, { email: 'bad' }, { fullName: ' ' }, { password: 'new' }, { tokenVersion: 0 }, {}]) expect(await api('PATCH', `/auth/users/${staff.id}`, body), 400);
      expect(await api('PATCH', `/auth/users/${staff.id}`, { email: admin.email }), 409);
      const updated = await api('PATCH', `/auth/users/${staff.id}`, { fullName: 'Edited Staff', role: 'Admin', email: 'EDITED@example.test' });
      expect(updated); assert.equal(updated.body.user.email, 'edited@example.test'); assert.equal(updated.body.user.password, undefined);
      expect(await api('GET', '/auth/me', undefined, staffToken), 401);
      const changedToken = await login('edited@example.test');
      expect(await api('GET', '/auth/users', undefined, changedToken));
      expect(await api('PATCH', `/auth/users/${staff.id}`, { role: 'IT Staff' }));
      expect(await api('GET', '/auth/me', undefined, changedToken), 401);
    });

    const { chromium } = require(process.env.QA_PLAYWRIGHT || '/tmp/smart-it-qa-tools/node_modules/playwright');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    async function pageFor(route, credential = token, role = 'Admin') {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      await page.addInitScript(({ credential, role, id }) => {
        localStorage.setItem('authToken', credential);
        localStorage.setItem('currentUser', JSON.stringify({ _id: id, fullName: 'Cached identity', role }));
      }, { credential, role, id: admin.id });
      if (route) await page.goto(origin + route);
      return page;
    }
    await t.test('401 clears session and login returns to intended route; password toggle and bad login work', async () => {
      const page = await pageFor('/assets', 'invalid');
      try {
        await page.waitForURL(origin + '/');
        assert.equal(await page.evaluate(() => localStorage.getItem('authToken')), null);
        await page.getByLabel('Email Address', { exact: true }).fill(admin.email);
        await page.getByLabel('Password', { exact: true }).fill('wrong');
        await page.getByRole('button', { name: 'Show password' }).click();
        assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'text');
        await page.getByRole('button', { name: 'Hide password' }).click();
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        await page.getByRole('alert').waitFor();
        await page.getByLabel('Password', { exact: true }).fill(password);
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        await page.waitForURL('**/assets');
      } finally { await page.close(); }
    });
    await t.test('403 stays signed in; staff cannot mount employee directory', async () => {
      const page = await pageFor();
      try {
        await page.route('**/api/assets', route => route.fulfill({ status: 403, json: { message: 'Forbidden by policy' } }));
        await page.goto(origin + '/assets');
        await page.getByText('Forbidden by policy').waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem('authToken')), token);
      } finally { await page.close(); }
      const staffPage = await pageFor('/employees', await login('edited@example.test'), 'IT Staff');
      try { await staffPage.waitForURL('**/dashboard'); assert.equal(await staffPage.getByRole('heading', { name: 'Personnel Directory' }).count(), 0); }
      finally { await staffPage.close(); }
    });
    await t.test('QR image 401 clears the session too', async () => {
      await asset('IMAGE-SESSION');
      const page = await pageFor();
      try {
        await page.route('**/api/qr/assets/*/image', route => route.fulfill({ status: 401, json: { message: 'Expired' } }));
        await page.goto(origin + '/qr-codes');
        await page.waitForURL(origin + '/');
        assert.equal(await page.evaluate(() => localStorage.getItem('currentUser')), null);
      } finally { await page.close(); }
    });
    await t.test('a late 401 cannot clear a newer login', async () => {
      const page = await pageFor();
      try {
        let release;
        const intercepted = new Promise(resolve => { release = resolve; });
        await page.route('**/api/assets', async route => {
          await intercepted;
          await route.fulfill({ status: 401, json: { message: 'Old request expired' } });
        });
        const sent = page.waitForRequest('**/api/assets');
        await page.goto(origin + '/assets');
        await sent;
        await page.evaluate(() => { localStorage.setItem('authToken', 'new-session-token'); });
        release();
        await page.getByText('Old request expired').waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem('authToken')), 'new-session-token');
        assert.equal(new URL(page.url()).pathname, '/assets');
      } finally { await page.close(); }
    });
    await t.test('logout in another tab redirects protected content', async () => {
      const page = await pageFor('/assets'); let other;
      try {
        other = await page.context().newPage();
        await other.goto(origin + '/');
        await other.evaluate(() => { localStorage.removeItem('authToken'); localStorage.removeItem('currentUser'); });
        await page.waitForURL(origin + '/');
      } finally { if (other) await other.close(); await page.close(); }
    });
    for (const [route, endpoint] of [['/dashboard', '/assets'], ['/profile', '/auth/me'], ['/employees', '/employees'], ['/licenses', '/licenses'], ['/maintainence', '/maintenance'], ['/users', '/auth/users']]) {
      for (const failure of ['server', 'network']) {
        await t.test(`${route} ${failure} failure is visible and retry recovers`, async () => {
          const page = await pageFor();
          try {
            const pattern = `**/api${endpoint}`;
            await page.route(pattern, route => failure === 'network' ? route.abort() : route.fulfill({ status: 500, json: { message: 'Simulated outage' } }));
            await page.goto(origin + route);
            await page.getByRole('alert').filter({ hasText: 'could not be loaded' }).waitFor();
            if (route === '/profile') assert.equal(await page.getByText('Cached identity', { exact: true }).count(), 1); // Sidebar only, not verified profile data.
            await page.unroute(pattern);
            await page.getByRole('button', { name: 'Retry', exact: true }).click();
            await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
          } finally { await page.close(); }
        });
      }
    }
    await t.test('asset browser add/edit/list/search retains serial numbers', async () => {
      const page = await pageFor('/assets/add');
      try {
        await page.locator('[name="assetName"]').fill('Browser serial asset');
        await page.getByLabel('Serial Number').fill('BROWSER-SERIAL');
        await page.getByRole('button', { name: 'Create Asset', exact: true }).click();
        await page.waitForURL('**/assets');
        const row = page.getByRole('row').filter({ hasText: 'BROWSER-SERIAL' });
        await row.waitFor();
        await row.getByRole('link').click();
        assert.equal(await page.getByLabel('Serial Number').inputValue(), 'BROWSER-SERIAL');
        await page.getByLabel('Serial Number').fill('BROWSER-EDITED');
        await page.getByRole('button', { name: 'Save Changes' }).click();
        await page.waitForURL('**/assets');
        await page.getByPlaceholder(/Search/).fill('browser-edited');
        await page.getByRole('row').filter({ hasText: 'BROWSER-EDITED' }).waitFor();
      } finally { await page.close(); }
    });
    for (const module of ['licenses', 'maintenance']) {
      await t.test(`${module} delete failure remains visible without losing the row`, async () => {
        const device = await asset();
        const body = module === 'licenses'
          ? { softwareName: 'Delete feedback license', vendor: 'Vendor', licenseKey: 'DELETE-ERROR', numberOfSeats: 1 }
          : { asset: device._id, maintenanceType: 'Repair', maintenanceDate: '2026-09-26', description: 'Delete feedback', status: 'Scheduled' };
        const record = expect(await api('POST', `/${module}`, body), 201);
        const page = await pageFor(module === 'licenses' ? '/licenses' : '/maintainence');
        try {
          page.on('dialog', dialog => dialog.accept());
          await page.route(`**/api/${module}/${record._id}`, route => route.fulfill({ status: 500, json: { message: 'Deletion unavailable' } }));
          const row = page.getByRole('row').filter({ hasText: module === 'licenses' ? 'Delete feedback license' : device.assetName });
          await row.getByRole('button', { name: /Delete/ }).click();
          await page.getByRole('alert').filter({ hasText: 'Deletion unavailable' }).waitFor();
          assert.ok(await row.isVisible());
          expect(await api('GET', `/${module}/${record._id}`));
        } finally { await page.close(); }
      });
    }
    await t.test('employee edit is prefilled, failed save retains values, cancel and deletion work', async () => {
      const person = await employee(); const page = await pageFor('/employees');
      try {
        await page.getByRole('button', { name: `Edit ${person.fullName}`, exact: true }).click();
        const dialog = page.getByRole('dialog');
        assert.equal(await dialog.getByLabel('Email', { exact: true }).inputValue(), person.email);
        fs.mkdirSync(path.join(__dirname, '../artifacts/qa/step5'), { recursive: true });
        await page.screenshot({ path: path.join(__dirname, '../artifacts/qa/step5/employee-editor.png'), fullPage: true });
        await dialog.getByLabel('Full Name').fill('Updated employee');
        await page.route(`**/api/employees/${person._id}`, route => route.fulfill({ status: 500, json: { message: 'Save failed' } }));
        await dialog.getByRole('button', { name: 'Save changes' }).click();
        await dialog.getByRole('alert').filter({ hasText: 'Save failed' }).waitFor();
        assert.equal(await dialog.getByLabel('Full Name').inputValue(), 'Updated employee');
        await page.unroute(`**/api/employees/${person._id}`);
        await dialog.getByRole('button', { name: 'Save changes' }).click();
        await dialog.waitFor({ state: 'detached' });
        assert.equal(expect(await api('GET', `/employees/${person._id}`)).fullName, 'Updated employee');
        await page.getByRole('button', { name: 'Edit Updated employee', exact: true }).click();
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        page.once('dialog', dialog => dialog.dismiss());
        await page.getByRole('button', { name: 'Delete Updated employee', exact: true }).click();
        expect(await api('GET', `/employees/${person._id}`));
        page.once('dialog', dialog => dialog.accept());
        await page.getByRole('button', { name: 'Delete Updated employee', exact: true }).click();
        await page.getByRole('button', { name: 'Delete Updated employee', exact: true }).waitFor({ state: 'detached' });
        expect(await api('GET', `/employees/${person._id}`), 404);
      } finally { await page.close(); }
    });
    await t.test('employee history conflicts remain visible in the editor and on deletion', async () => {
      const person = await employee(); const device = await asset();
      expect(await api('POST', '/allocations', { assetId: device._id, employeeId: person._id }), 201);
      const page = await pageFor('/employees');
      try {
        page.on('dialog', dialog => dialog.accept());
        await page.getByRole('button', { name: `Delete ${person.fullName}`, exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'allocation history' }).waitFor();
        await page.getByRole('button', { name: `Edit ${person.fullName}`, exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Status').selectOption('Inactive');
        await dialog.getByRole('button', { name: 'Save changes' }).click();
        await dialog.getByRole('alert').filter({ hasText: 'Return active allocations' }).waitFor();
      } finally { await page.close(); }
    });
    await t.test('account browser editing revokes sessions and provisioning success survives refresh', async () => {
      const page = await pageFor('/users');
      try {
        await page.getByRole('button', { name: 'Edit Edited Staff', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Full Name').fill('Browser edited account');
        await dialog.getByLabel('Role').selectOption('Admin');
        await dialog.getByRole('button', { name: 'Save changes' }).click();
        await dialog.waitFor({ state: 'detached' });
        await page.getByText('Account updated. Existing sessions have been revoked.').waitFor();
        await page.locator('input[name="fullName"]').fill('Persistent success user');
        await page.locator('input[name="email"]').fill('success@example.test');
        await page.locator('input[name="password"]').fill(password);
        await page.getByRole('button', { name: 'Create User', exact: true }).click();
        await page.getByText('System User "Persistent success user" created successfully.').waitFor();
        await page.getByRole('button', { name: 'Edit Persistent success user', exact: true }).waitFor();
        assert.ok(await page.getByText('System User "Persistent success user" created successfully.').isVisible());
      } finally { await page.close(); }
    });
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  }
});
