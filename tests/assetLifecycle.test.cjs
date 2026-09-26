const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(process.env.QA_APP_ROOT || path.join(__dirname, '..'));
const dependency = name => require(path.join(root, 'node_modules', name));
const mongoose = dependency('mongoose');
const express = dependency('express');
const jwt = dependency('jsonwebtoken');
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const Asset = require(path.join(root, 'models/Asset'));
const Allocation = require(path.join(root, 'models/Allocation'));
const Maintenance = require(path.join(root, 'models/Maintenance'));
const QRCode = require(path.join(root, 'models/QRCode'));
const User = require(path.join(root, 'models/User'));
const Employee = require(path.join(root, 'models/Employee'));
const lifecycle = require(path.join(root, 'services/assetLifecycle'));
const { startMongo } = require('./qa/mongo-fixture.cjs');

test('Transactional asset lifecycle on a disposable replica set', { timeout: 150000 }, async t => {
  let mongo, server, browser;
  try {
    mongo = await startMongo();
    const database = `smart_it_lifecycle_${Date.now()}`;
    await mongoose.connect(mongo.uri(database));
    const user = await User.create({ fullName: 'Lifecycle Admin', email: 'lifecycle@example.test', role: 'Admin', password: 'not-used-for-login' });
    const employee = await Employee.create({ fullName: 'Lifecycle Employee', email: 'employee@example.test', employeeId: 'LIFE-1', department: 'IT', designation: 'Technician' });
    const token = jwt.sign({ userId: user.id, tokenVersion: 0 }, process.env.JWT_SECRET);
    const app = express();
    app.use(express.json());
    for (const [prefix, file] of Object.entries({ auth: 'auth', assets: 'asset', allocations: 'allocation', employees: 'employee', maintenance: 'maintenance', qr: 'qrCode' })) {
      app.use(`/api/${prefix}`, require(path.join(root, `routes/${file}Routes`)));
    }
    app.use(express.static(path.join(root, 'frontend/dist')));
    app.get('*', (req, res) => res.sendFile(path.join(root, 'frontend/dist/index.html')));
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function api(method, route, body) {
      const response = await fetch(`${origin}/api${route}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
      });
      return { status: response.status, body: await response.json() };
    }
    function expect(response, status = 200) {
      assert.equal(response.status, status, JSON.stringify(response.body));
      return response.body.data;
    }
    let sequence = 0;
    const asset = async (status = 'Available') => expect(await api('POST', '/assets', { assetName: `Lifecycle ${++sequence}`, status }), 201);
    const allocation = async device => expect(await api('POST', '/allocations', { assetId: device._id, employeeId: employee.id }), 201);
    const job = async (device, status = 'In Progress') => expect(await api('POST', '/maintenance', {
      asset: device._id, maintenanceType: 'Repair', description: 'Lifecycle regression', maintenanceDate: '2026-09-25', status,
    }), 201);
    const assetStatus = async device => (await Asset.findById(device._id)).status;
    const finish = async record => expect(await api('PUT', `/maintenance/${record._id}`, { status: 'Completed' }));

    await t.test('preflight refuses duplicates without deleting records; index blocks direct duplicates', async () => {
      const rawId = new mongoose.Types.ObjectId();
      await Allocation.collection.insertMany([1, 2].map(() => ({ asset: rawId, user: user._id, allocationDate: new Date(), allocationStatus: 'Allocated' })));
      const preflight = spawnSync(process.execPath, [path.join(root, 'scripts/lifecycle-preflight.js'), '--apply'], {
        cwd: root, env: { ...process.env, MONGO_URI: mongo.uri(database) }, timeout: 10000,
      });
      assert.equal(preflight.status, 1);
      assert.match(preflight.stderr.toString(), /Duplicate active allocations/);
      assert.equal(await Allocation.countDocuments(), 2);
      const blocked = await api('POST', '/assets', { assetName: 'Blocked by bad index' });
      expect(blocked, 503);
      assert.equal(await Asset.countDocuments(), 0);
      await Allocation.deleteMany({ asset: rawId });
      await lifecycle.ensureAllocationIndex();
      await Allocation.create({ asset: rawId, user: user._id, allocationDate: new Date() });
      await assert.rejects(Allocation.create({ asset: rawId, user: user._id, allocationDate: new Date() }), { code: 11000 });
      await Allocation.create({ asset: rawId, user: user._id, allocationDate: new Date(), allocationStatus: 'Returned' });
      await Allocation.deleteMany({ asset: rawId });
    });
    await t.test('12 simultaneous requests create exactly one allocation', async () => {
      const device = await asset();
      const responses = await Promise.all(Array.from({ length: 12 }, () => api('POST', '/allocations', { assetId: device._id, employeeId: employee.id })));
      assert.equal(responses.filter(response => response.status === 201).length, 1);
      assert.equal(responses.filter(response => response.status === 409).length, 11);
      assert.equal(await Allocation.countDocuments({ asset: device._id, allocationStatus: 'Allocated' }), 1);
      assert.equal(await assetStatus(device), 'Allocated');
    });
    for (const status of ['Scheduled', 'In Progress']) {
      await t.test(`${status} maintenance reserves a device, completion releases it and reopening reserves it again`, async () => {
        const device = await asset();
        const record = await job(device, status);
        assert.equal(record.asset.status, 'Maintenance');
        assert.equal(await assetStatus(device), 'Maintenance');
        expect(await api('POST', '/allocations', { assetId: device._id, employeeId: employee.id }), 409);
        assert.equal((await finish(record)).asset.status, 'Available');
        expect(await api('PUT', `/maintenance/${record._id}`, { status }));
        assert.equal(await assetStatus(device), 'Maintenance');
      });
    }
    await t.test('multiple open jobs and assigned devices reconcile on each completion', async () => {
      const device = await asset();
      const assigned = await allocation(device);
      const first = await job(device);
      const second = await job(device, 'Scheduled');
      assert.equal((await finish(first)).asset.status, 'Maintenance');
      assert.equal((await finish(second)).asset.status, 'Allocated');
      expect(await api('PATCH', `/allocations/${assigned._id}/return`, {}));
      assert.equal(await assetStatus(device), 'Available');
    });
    for (const action of ['return', 'delete']) {
      await t.test(`${action} allocation preserves open maintenance`, async () => {
        const device = await asset();
        const assigned = await allocation(device);
        const record = await job(device);
        expect(await api(action === 'return' ? 'PATCH' : 'DELETE', `/allocations/${assigned._id}${action === 'return' ? '/return' : ''}`, {}));
        assert.equal(await assetStatus(device), 'Maintenance');
        assert.equal((await finish(record)).asset.status, 'Available');
      });
    }
    await t.test('manual maintenance survives returns; a recorded repair replaces the manual hold', async () => {
      const device = await asset();
      const assigned = await allocation(device);
      expect(await api('PUT', `/assets/${device._id}`, { status: 'Maintenance' }));
      expect(await api('PATCH', `/allocations/${assigned._id}/return`, {}));
      assert.equal(await assetStatus(device), 'Maintenance');
      const record = await job(device);
      assert.equal((await finish(record)).asset.status, 'Available');
    });
    await t.test('QR and direct edits reject bypasses and phantom allocations', async () => {
      const device = await asset();
      const qr = await QRCode.findOne({ asset: device._id });
      for (const status of ['Allocated']) {
        expect(await api('PUT', `/assets/${device._id}`, { status }), 409);
        expect(await api('PATCH', '/qr/status', { code: qr.token, status }), 409);
      }
      const assigned = await allocation(device);
      for (const status of ['Available', 'Retired']) {
        expect(await api('PUT', `/assets/${device._id}`, { status }), 409);
        expect(await api('PATCH', '/qr/status', { code: qr.token, status }), 409);
      }
      const record = await job(device);
      for (const status of ['Available', 'Allocated']) {
        expect(await api('PUT', `/assets/${device._id}`, { status }), 409);
        expect(await api('PATCH', '/qr/status', { code: qr.token, status }), 409);
      }
      expect(await api('PUT', `/assets/${device._id}`, { assetName: 'Renamed during repair', status: 'Maintenance' }));
      assert.equal((await finish(record)).asset.status, 'Allocated');
      expect(await api('PATCH', `/allocations/${assigned._id}/return`, {}));
      expect(await api('PATCH', '/qr/status', { code: qr.token, status: 'Available' }));
      expect(await api('POST', '/assets', { assetName: 'Phantom', status: 'Allocated' }), 409);
    });
    await t.test('retirement survives completion, deletion and legacy active-allocation return', async () => {
      const device = await asset();
      const record = await job(device);
      expect(await api('PUT', `/assets/${device._id}`, { status: 'Retired' }));
      assert.equal((await finish(record)).asset.status, 'Retired');
      expect(await api('PUT', `/maintenance/${record._id}`, { status: 'In Progress' }), 409);
      expect(await api('DELETE', `/maintenance/${record._id}`));
      assert.equal(await assetStatus(device), 'Retired');
      const legacy = await Allocation.create({ asset: device._id, user: user._id, allocationDate: new Date() });
      expect(await api('PATCH', `/allocations/${legacy.id}/return`, {}));
      assert.equal(await assetStatus(device), 'Retired');
    });
    await t.test('moving and deleting maintenance reconciles both old and new assets', async () => {
      const from = await asset();
      const to = await asset();
      const record = await job(from);
      expect(await api('PUT', `/maintenance/${record._id}`, { asset: to._id }));
      assert.equal(await assetStatus(from), 'Available');
      assert.equal(await assetStatus(to), 'Maintenance');
      expect(await api('DELETE', `/maintenance/${record._id}`));
      assert.equal(await assetStatus(to), 'Available');
    });
    await t.test('deleting returned history preserves a newer active allocation', async () => {
      const device = await asset();
      const old = await allocation(device);
      expect(await api('PATCH', `/allocations/${old._id}/return`, {}));
      const current = await allocation(device);
      expect(await api('DELETE', `/allocations/${old._id}`));
      assert.equal(await assetStatus(device), 'Allocated');
      assert.equal((await Allocation.findById(current._id)).allocationStatus, 'Allocated');
    });
    await t.test('duplicate returns cannot revive or overwrite a newer allocation', async () => {
      const device = await asset();
      const record = await allocation(device);
      const responses = await Promise.all([1, 2].map(() => api('PATCH', `/allocations/${record._id}/return`, {})));
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
      await allocation(device);
      expect(await api('PATCH', `/allocations/${record._id}/return`, {}), 409);
      assert.equal(await assetStatus(device), 'Allocated');
    });
    await t.test('saving historical completion repairs stale status; missing records return 404', async () => {
      const device = await asset();
      const record = await job(device);
      await finish(record);
      await Asset.updateOne({ _id: device._id }, { status: 'Maintenance' });
      assert.equal(expect(await api('PUT', `/maintenance/${record._id}`, { description: 'Corrected notes' })).asset.status, 'Available');
      expect(await api('PUT', `/maintenance/${new mongoose.Types.ObjectId()}`, { status: 'Completed' }), 404);
      expect(await api('PUT', `/assets/${new mongoose.Types.ObjectId()}`, { status: 'Available' }), 404);
    });
    await t.test('invalid input and nonexistent references leave no partial changes', async () => {
      const device = await asset();
      const record = await job(device);
      expect(await api('PUT', `/maintenance/${record._id}`, { asset: String(new mongoose.Types.ObjectId()) }), 404);
      expect(await api('PUT', `/maintenance/${record._id}`, { status: 'Invalid' }), 400);
      expect(await api('PUT', `/assets/${device._id}`, { status: 'Invalid' }), 400);
      expect(await api('POST', '/assets', { assetName: 'Invalid initial state', status: null }), 400);
      assert.equal(await assetStatus(device), 'Maintenance');
      assert.equal(String((await Maintenance.findById(record._id)).asset), device._id);
      const available = await asset();
      expect(await api('POST', '/allocations', { assetId: available._id, employeeId: employee.id, allocationDate: 'not-a-date' }), 400);
      assert.equal(await assetStatus(available), 'Available');
      assert.equal(await Allocation.countDocuments({ asset: available._id }), 0);
    });
    await t.test('failure after inserting allocation rolls back both records', async () => {
      const device = await asset();
      const original = Asset.prototype.save;
      Asset.prototype.save = async function (...args) {
        if (String(this._id) === device._id && this.status === 'Allocated') throw new Error('Injected asset-write failure');
        return original.apply(this, args);
      };
      try { expect(await api('POST', '/allocations', { assetId: device._id, employeeId: employee.id }), 500); }
      finally { Asset.prototype.save = original; }
      assert.equal(await Allocation.countDocuments({ asset: device._id }), 0);
      assert.equal(await assetStatus(device), 'Available');
    });
    await t.test('failure during maintenance completion rolls back the job and asset', async () => {
      const device = await asset();
      const record = await job(device);
      const original = Asset.prototype.save;
      Asset.prototype.save = async function (...args) {
        if (String(this._id) === device._id && this.status === 'Available') throw new Error('Injected reconciliation failure');
        return original.apply(this, args);
      };
      try { expect(await api('PUT', `/maintenance/${record._id}`, { status: 'Completed' }), 500); }
      finally { Asset.prototype.save = original; }
      assert.equal((await Maintenance.findById(record._id)).status, 'In Progress');
      assert.equal(await assetStatus(device), 'Maintenance');
    });
    for (const race of ['create', 'complete', 'return', 'delete', 'manual', 'move']) {
      await t.test(`concurrent maintenance ${race} and lifecycle operations remain consistent`, async () => {
        for (let iteration = 0; iteration < 3; iteration++) {
          const device = await asset();
          let requests;
          if (race === 'create') {
            requests = [api('POST', '/allocations', { assetId: device._id, employeeId: employee.id }), api('POST', '/maintenance', { asset: device._id, maintenanceType: 'Repair', description: 'Race', maintenanceDate: '2026-09-25' })];
          } else if (race === 'complete') {
            const a = await job(device); const b = await job(device);
            requests = [api('PUT', `/maintenance/${a._id}`, { status: 'Completed' }), api('PUT', `/maintenance/${b._id}`, { status: 'Completed' })];
          } else if (race === 'return' || race === 'delete') {
            const assigned = await allocation(device); const record = await job(device);
            requests = [api(race === 'return' ? 'PATCH' : 'DELETE', `/allocations/${assigned._id}${race === 'return' ? '/return' : ''}`, {}), api('PUT', `/maintenance/${record._id}`, { status: 'Completed' })];
          } else if (race === 'manual') {
            requests = [api('PUT', `/assets/${device._id}`, { status: 'Retired' }), api('POST', '/allocations', { assetId: device._id, employeeId: employee.id })];
          } else {
            const other = await asset(); const record = await job(other);
            requests = [api('PUT', `/maintenance/${record._id}`, { asset: device._id }), api('POST', '/allocations', { assetId: device._id, employeeId: employee.id })];
          }
          const results = await Promise.all(requests);
          assert.ok(results.every(result => [200, 201, 409].includes(result.status)), JSON.stringify(results));
          const open = await Maintenance.exists({ asset: device._id, status: { $in: ['Scheduled', 'In Progress'] } });
          const assigned = await Allocation.countDocuments({ asset: device._id, allocationStatus: 'Allocated' });
          const actual = await assetStatus(device);
          assert.ok(assigned <= 1);
          if (actual === 'Retired') assert.equal(assigned, 0);
          else assert.equal(actual, open ? 'Maintenance' : assigned ? 'Allocated' : 'Available');
        }
      });
    }
    await t.test('asset deletion cannot race with maintenance or allocation creation', async () => {
      for (const module of ['maintenance', 'allocations']) {
        const device = await asset();
        const payload = module === 'allocations' ? { assetId: device._id, employeeId: employee.id } : { asset: device._id, maintenanceType: 'Repair', description: 'Race deletion', maintenanceDate: '2026-09-25' };
        const responses = await Promise.all([api('DELETE', `/assets/${device._id}`), api('POST', `/${module}`, payload)]);
        assert.ok(responses.every(response => [200, 201, 404, 409].includes(response.status)));
        const exists = await Asset.exists({ _id: device._id });
        const refs = await Allocation.countDocuments({ asset: device._id }) + await Maintenance.countDocuments({ asset: device._id });
        assert.ok(exists || refs === 0);
      }
    });
    await t.test('returned and completed history prevent asset deletion; unreferenced asset and QR delete together', async () => {
      const device = await asset(); const record = await job(device); await finish(record);
      expect(await api('DELETE', `/assets/${device._id}`), 409);
      const unreferenced = await asset();
      expect(await api('DELETE', `/assets/${unreferenced._id}`));
      assert.equal(await QRCode.countDocuments({ asset: unreferenced._id }), 0);
    });
    await t.test('standalone MongoDB fails safely without persisting the attempted asset', async () => {
      const standalone = await startMongo({ replicaSet: false });
      try {
        const code = `const m=require('./node_modules/mongoose'); const lifecycle=require('./services/assetLifecycle');
          (async()=>{await m.connect(process.env.TEST_URI);try{await lifecycle.createAsset({assetName:'Must not persist'});process.exitCode=1;}catch(e){if(e.status!==503)throw e;}
          if(await require('./models/Asset').countDocuments())process.exitCode=1;})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>m.disconnect());`;
        const result = spawnSync(process.execPath, ['-e', code], { cwd: root, env: { ...process.env, TEST_URI: standalone.uri('standalone_test') }, timeout: 15000 });
        assert.equal(result.status, 0, result.stderr.toString());
      } finally { await standalone.stop(); }
    });
    if (process.env.QA_BROWSER === '1') {
      await t.test('browser allocation deletion refreshes choices; maintenance completion refreshes Assets', async () => {
        const { chromium } = require(process.env.QA_PLAYWRIGHT || 'playwright');
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const page = await browser.newPage();
        await page.addInitScript(({ token, user }) => {
          localStorage.setItem('authToken', token); localStorage.setItem('currentUser', JSON.stringify(user));
        }, { token, user: { _id: user.id, fullName: user.fullName, role: 'Admin' } });
        const device = await asset(); await allocation(device);
        await page.goto(`${origin}/allocations`);
        page.on('dialog', dialog => dialog.accept());
        const row = page.locator('tr').filter({ hasText: device.assetName });
        await row.getByRole('button', { name: /delete/i }).click();
        await row.waitFor({ state: 'detached' });
        await page.getByRole('button', { name: /New Allocation/ }).click();
        await page.locator('select[name=asset] option').filter({ hasText: device.assetName }).waitFor({ state: 'attached' });
        const record = await job(device);
        await page.goto(`${origin}/assets`);
        await page.locator('tr').filter({ hasText: device.assetName }).getByText('Maintenance', { exact: true }).waitFor();
        await finish(record);
        await page.reload();
        await page.locator('tr').filter({ hasText: device.assetName }).getByText('Available', { exact: true }).waitFor();
      });
    }
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  }
});
