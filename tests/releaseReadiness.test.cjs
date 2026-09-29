const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(process.env.QA_APP_ROOT || path.join(__dirname, '..'));
const dependency = name => require(path.join(root, 'node_modules', name));
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.NODE_ENV = 'production';
const mongoose = dependency('mongoose');
const jwt = dependency('jsonwebtoken');
const { startMongo } = require('./qa/mongo-fixture.cjs');
const out = path.join(__dirname, '../artifacts/qa/release');
fs.mkdirSync(out, { recursive: true });

test('Release server, accessibility, layouts and navigation', { timeout: 240000 }, async t => {
  let mongo, server, browser;
  try {
    mongo = await startMongo();
    await mongoose.connect(mongo.uri(`smart_it_release_${Date.now()}`));
    const User = require(path.join(root, 'models/User'));
    const admin = await User.create({ fullName: 'Release Administrator', email: 'release@example.test', password: 'unused', role: 'Admin' });
    const token = jwt.sign({ userId: admin.id, tokenVersion: 0 }, process.env.JWT_SECRET);
    const app = require(path.join(root, 'server.js'));
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function api(method, route, body) {
      const response = await fetch(origin + '/api' + route, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
      assert.ok(response.ok, await response.clone().text());
      return (await response.json()).data;
    }
    const asset = await api('POST', '/assets', { assetName: 'Release laptop', serialNumber: 'RELEASE-001', category: 'Laptop', brand: 'Vendor', model: 'Professional', location: 'Main office' });
    await api('POST', '/employees', { fullName: 'Release Employee', employeeId: 'REL-01', email: 'person@example.test', department: 'Operations', designation: 'Engineer' });
    await api('POST', '/licenses', { softwareName: 'Release Software', vendor: 'Vendor', licenseKey: 'REL-KEY', numberOfSeats: 10, assignedSeats: 2, licenseType: 'Subscription', status: 'Expiring Soon', cost: 12.50 });
    await api('POST', '/maintenance', { asset: asset._id, maintenanceType: 'Repair', status: 'Scheduled', maintenanceDate: '2026-09-27', description: 'Release service', cost: 12.50 });
    await t.test('production serves deep links, rejects missing API/assets and sets security headers', async () => {
      const response = await fetch(origin + '/assets/add');
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /html/);
      assert.ok(response.headers.get('content-security-policy'));
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('x-powered-by'), null);
      assert.equal((await fetch(origin + '/api/does-not-exist')).status, 404);
      assert.equal((await fetch(origin + '/missing.js')).status, 404);
      assert.equal((await fetch(origin + '/health')).status, 200);
      const invalid = await fetch(origin + '/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
      assert.equal(invalid.status, 400);
      const large = await fetch(origin + '/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(70000) }) });
      assert.equal(large.status, 413);
      const anonymous = await fetch(origin + '/api/assets', { headers: { Origin: 'https://untrusted.example' } });
      assert.equal(anonymous.status, 401);
      assert.equal(anonymous.headers.get('access-control-allow-origin'), null);
    });
    await t.test('startup refuses missing or unreachable MongoDB configuration', () => {
      for (const uri of ['', 'mongodb://127.0.0.1:1/unreachable']) {
        const result = spawnSync(process.execPath, [path.join(root, 'server.js')], {
          cwd: root, env: { ...process.env, MONGO_URI: uri, NODE_ENV: 'production' }, timeout: 10000,
        });
        assert.equal(result.status, 1, result.stderr.toString());
        assert.doesNotMatch(result.stdout.toString(), /Server running/);
      }
    });
    const { chromium } = require('/tmp/smart-it-qa-tools/node_modules/playwright');
    const AxeBuilder = require('/tmp/smart-it-qa-tools/node_modules/@axe-core/playwright').default;
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    const context = await browser.newContext();
    await context.addInitScript(({ token, id }) => { localStorage.setItem('authToken', token); localStorage.setItem('currentUser', JSON.stringify({ _id: id, fullName: 'Release Administrator', role: 'Admin' })); }, { token, id: admin.id });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const accessibility = [];
    const routes = ['/', '/dashboard', '/assets', '/assets/add', `/assets/${asset._id}/edit`, '/allocations', '/users', '/employees', '/licenses', '/maintainence', '/qr-codes', '/profile'];
    for (const route of routes) {
      for (const width of [1440, 1024, 768, 390]) {
        await t.test(`${route} fits ${width}px and tables remain reachable`, async () => {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(origin + route, { waitUntil: 'networkidle' });
          const layout = await page.evaluate(() => {
            const tables = [...document.querySelectorAll('table')].map(table => {
              let parent = table.parentElement;
              while (parent && !['auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) parent = parent.parentElement;
              const last = table.querySelector('th:last-child');
              if (parent) parent.scrollLeft = parent.scrollWidth;
              const right = last?.getBoundingClientRect().right || 0;
              return right <= innerWidth + 2;
            });
            return { width: innerWidth, document: document.documentElement.scrollWidth, tables };
          });
          assert.ok(layout.document <= width + 2, JSON.stringify(layout));
          assert.ok(layout.tables.every(Boolean), JSON.stringify(layout));
          await page.screenshot({ path: path.join(out, `${route.replace(/\W+/g, '-') || 'login'}-${width}.png`), fullPage: true });
        });
      }
      await t.test(`${route} axe WCAG A/AA scan`, async () => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(origin + route, { waitUntil: 'networkidle' });
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        accessibility.push({ route, violations: result.violations });
        fs.writeFileSync(path.join(out, 'accessibility.json'), JSON.stringify(accessibility, null, 2));
        assert.deepEqual(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
      });
    }
    for (const [route, button] of [['/allocations', 'New Allocation'], ['/licenses', 'Add License'], ['/maintainence', 'New Record']]) {
      await t.test(`${route} modal keyboard focus, Escape, mobile sizing and axe`, async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(origin + route, { waitUntil: 'networkidle' });
        const trigger = page.getByRole('button', { name: button, exact: true });
        await trigger.click();
        const dialog = page.getByRole('dialog'); await dialog.waitFor();
        for (let i = 0; i < 25; i++) {
          await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
          assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)));
        }
        assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 2));
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        accessibility.push({ route: route + ' modal', violations: result.violations });
        fs.writeFileSync(path.join(out, 'accessibility.json'), JSON.stringify(accessibility, null, 2));
        assert.deepEqual(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
        assert.ok(await trigger.evaluate(el => el === document.activeElement));
      });
    }
    await t.test('Profile is in the account footer and collapse preserves its accessible link', async () => {
      await page.goto(origin + '/dashboard');
      assert.equal(await page.locator('nav').getByRole('link', { name: 'Profile', exact: true }).count(), 0);
      const link = page.locator('.sidebar-footer').getByRole('link', { name: 'Profile', exact: true });
      await link.click(); await page.waitForURL('**/profile');
      await page.getByRole('button', { name: /sidebar/ }).click();
      assert.ok(await link.isVisible());
    });
    await t.test('camera startup works under production CSP and stops cleanly', async () => {
      await page.goto(origin + '/qr-codes', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Start camera', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
      await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
      await page.getByRole('button', { name: 'Start camera', exact: true }).waitFor();
      assert.deepEqual(errors, []);
    });
    await t.test('login throttle returns 429 after repeated attempts', async () => {
      let response;
      for (let i = 0; i < 21; i++) response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 429);
      assert.ok(response.headers.get('ratelimit'));
    });
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  }
});
