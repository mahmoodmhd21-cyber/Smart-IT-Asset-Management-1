const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const root = path.resolve(process.env.QA_APP_ROOT || path.join(__dirname, '..'));
const dependency = name => require(path.join(root, 'node_modules', name));
const mongoose = dependency('mongoose');
const express = dependency('express');
const jwt = dependency('jsonwebtoken');
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const model = name => require(path.join(root, 'models', name));
const User = model('User'), Employee = model('Employee'), Asset = model('Asset');
const Allocation = model('Allocation'), License = model('License'), QRCode = model('QRCode');
const { migrate } = require(path.join(root, 'services/allocationMigration'));
const { startMongo } = require('./qa/mongo-fixture.cjs');

test('Step 3 contracts and reference integrity', { timeout: 180000 }, async t => {
  let mongo, server, browser;
  try {
    mongo = await startMongo();
    await mongoose.connect(mongo.uri(`smart_it_contracts_${Date.now()}`));
    const admin = await User.create({ fullName: 'Contract Admin', email: 'admin@example.test', password: 'unused', role: 'Admin' });
    const staff = await User.create({ fullName: 'Contract Staff', email: 'staff@example.test', password: 'unused', role: 'IT Staff' });
    const tokenFor = user => jwt.sign({ userId: user.id, tokenVersion: 0 }, process.env.JWT_SECRET);
    const token = tokenFor(admin), staffToken = tokenFor(staff);
    const app = express(); app.use(express.json());
    for (const [prefix, file] of Object.entries({ auth: 'auth', assets: 'asset', allocations: 'allocation', employees: 'employee', maintenance: 'maintenance', licenses: 'license', qr: 'qrCode' })) {
      app.use(`/api/${prefix}`, require(path.join(root, `routes/${file}Routes`)));
    }
    app.use(express.static(path.join(root, 'frontend/dist')));
    app.get('*', (req, res) => res.sendFile(path.join(root, 'frontend/dist/index.html')));
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function api(method, route, body, credential = token) {
      const response = await fetch(`${origin}/api${route}`, { method,
        headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      return { status: response.status, body: await response.json() };
    }
    function expect(response, status = 200) { assert.equal(response.status, status, JSON.stringify(response.body)); return response.body.data; }
    let sequence = 0;
    const newAsset = async () => expect(await api('POST', '/assets', { assetName: `Contract Asset ${++sequence}` }), 201);
    const employeeBody = () => ({ fullName: `Contract Employee ${++sequence}`, email: `person${sequence}@example.test`, employeeId: `EMP-${sequence}`, department: 'IT', designation: 'Technician' });
    const newEmployee = async () => expect(await api('POST', '/employees', employeeBody()), 201);
    const assign = async (asset, employee) => expect(await api('POST', '/allocations', { assetId: asset._id, employeeId: employee._id }), 201);
    const jobBody = asset => ({ asset: asset._id, maintenanceType: 'Repair', maintenanceDate: '2026-09-26', description: 'Contract check', status: 'Scheduled', cost: 12.5 });
    const licenseBody = () => ({ softwareName: `Software ${++sequence}`, vendor: 'Vendor', licenseKey: `KEY-${sequence}`, numberOfSeats: 10, assignedSeats: 3, licenseType: 'Subscription', status: 'Active', cost: 12.5, notes: 'Persist these notes' });

    for (const type of ['Preventive', 'Corrective', 'Repair', 'Upgrade', 'Inspection', 'Replacement', 'Cleaning']) {
      await t.test(`maintenance ${type} persists and cancellation releases availability`, async () => {
        const asset = await newAsset();
        const record = expect(await api('POST', '/maintenance', { ...jobBody(asset), maintenanceType: type }), 201);
        assert.equal(record.maintenanceType, type); assert.equal(record.cost, 12.5);
        assert.equal(record.asset.status, 'Maintenance');
        const cancelled = expect(await api('PUT', `/maintenance/${record._id}`, { status: 'Cancelled' }));
        assert.equal(cancelled.status, 'Cancelled'); assert.equal(cancelled.asset.status, 'Available');
        expect(await api('PUT', `/maintenance/${record._id}`, { status: 'In Progress' }));
        assert.equal((await Asset.findById(asset._id)).status, 'Maintenance');
        await api('DELETE', `/maintenance/${record._id}`);
        assert.equal((await Asset.findById(asset._id)).status, 'Available');
      });
    }
    await t.test('cancellation respects active assignments, other jobs and retirement', async () => {
      const employee = await newEmployee(); const asset = await newAsset();
      const allocation = await assign(asset, employee);
      const a = expect(await api('POST', '/maintenance', jobBody(asset)), 201);
      const b = expect(await api('POST', '/maintenance', jobBody(asset)), 201);
      assert.equal(expect(await api('PUT', `/maintenance/${a._id}`, { status: 'Cancelled' })).asset.status, 'Maintenance');
      assert.equal(expect(await api('PUT', `/maintenance/${b._id}`, { status: 'Cancelled' })).asset.status, 'Allocated');
      expect(await api('PATCH', `/allocations/${allocation._id}/return`, {}));
      expect(await api('PUT', `/assets/${asset._id}`, { status: 'Retired' }));
      assert.equal(expect(await api('PUT', `/maintenance/${a._id}`, { status: 'Completed' })).asset.status, 'Retired');
    });
    await t.test('maintenance validates required text, enums, dates and asset references', async () => {
      const asset = await newAsset();
      for (const change of [{ description: '' }, { maintenanceType: 'Unknown' }, { status: null }, { maintenanceDate: 'bad' }, { cost: -1 }, { cost: 'Infinity' }]) {
        expect(await api('POST', '/maintenance', { ...jobBody(asset), ...change }), 400);
      }
      expect(await api('POST', '/maintenance', { ...jobBody(asset), asset: String(new mongoose.Types.ObjectId()) }), 404);
      assert.equal((await Asset.findById(asset._id)).status, 'Available');
    });
    for (const licenseType of ['Perpetual', 'Subscription', 'Trial', 'Open Source']) {
      await t.test(`license ${licenseType} round-trips every form field`, async () => {
        const body = { ...licenseBody(), licenseType, purchaseDate: '2026-09-01', expiryDate: '2027-09-01' };
        const record = expect(await api('POST', '/licenses', body), 201);
        const saved = expect(await api('GET', `/licenses/${record._id}`));
        for (const key of ['softwareName', 'vendor', 'licenseKey', 'licenseType', 'numberOfSeats', 'assignedSeats', 'cost', 'status', 'notes']) assert.equal(saved[key], body[key]);
        assert.ok(saved.purchaseDate.startsWith(body.purchaseDate)); assert.ok(saved.expiryDate.startsWith(body.expiryDate));
        expect(await api('PUT', `/licenses/${record._id}`, { assignedSeats: 4, notes: 'Edited notes', cost: 25.75 }));
        assert.equal(expect(await api('GET', `/licenses/${record._id}`)).cost, 25.75);
      });
    }
    for (const status of ['Active', 'Expired', 'Expiring Soon', 'Suspended']) {
      await t.test(`license status ${status} is supported`, async () => {
        assert.equal(expect(await api('POST', '/licenses', { ...licenseBody(), status }), 201).status, status);
      });
    }
    await t.test('license seat validation includes partial updates and concurrent edits', async () => {
      for (const change of [{ assignedSeats: 11 }, { assignedSeats: 1.5 }, { numberOfSeats: 2.5 }, { assignedSeats: -1 }, { numberOfSeats: -1 }, { licenseKey: '' }, { status: null }, { seatsUsed: 3 }, { cost: 'Infinity' }]) {
        expect(await api('POST', '/licenses', { ...licenseBody(), ...change }), 400);
      }
      const record = expect(await api('POST', '/licenses', licenseBody()), 201);
      expect(await api('PUT', `/licenses/${record._id}`, { numberOfSeats: 2 }), 400);
      const responses = await Promise.all([api('PUT', `/licenses/${record._id}`, { numberOfSeats: 4 }), api('PUT', `/licenses/${record._id}`, { assignedSeats: 8 })]);
      assert.ok(responses.every(response => [200, 400].includes(response.status)));
      const saved = expect(await api('GET', `/licenses/${record._id}`));
      assert.ok(saved.assignedSeats <= saved.numberOfSeats);
      expect(await api('POST', '/licenses', { ...licenseBody(), licenseKey: record.licenseKey }), 409);
    });
    await t.test('legacy license usage is retained and missing fields remain unknown', async () => {
      const inserted = await License.collection.insertOne({ softwareName: 'Historical', vendor: 'Vendor', licenseKey: 'OLD', numberOfSeats: 10, assignedSeats: 6, status: 'Suspended' });
      const record = expect(await api('GET', `/licenses/${inserted.insertedId}`));
      assert.equal(record.assignedSeats, 6); assert.equal(record.licenseType, null); assert.equal(record.cost, null);
      const updated = expect(await api('PUT', `/licenses/${inserted.insertedId}`, { notes: 'Preserve usage' }));
      assert.equal(updated.assignedSeats, 6);
    });
    await t.test('new employees are allocatable without login accounts; picker is authenticated and limited', async () => {
      const employee = await newEmployee();
      expect(await api('GET', '/employees/assignees', undefined, null), 401);
      const picker = expect(await api('GET', '/employees/assignees', undefined, staffToken));
      const option = picker.find(item => item._id === employee._id);
      assert.deepEqual(Object.keys(option).sort(), ['_id', 'employeeId', 'fullName']);
      const asset = await newAsset();
      const record = expect(await api('POST', '/allocations', { assetId: asset._id, employeeId: employee._id }, staffToken), 201);
      assert.equal(expect(await api('GET', `/allocations/${record._id}`)).employee.fullName, employee.fullName);
      expect(await api('POST', '/allocations', { assetId: asset._id, userId: staff.id }), 400);
      expect(await api('DELETE', `/employees/${employee._id}`), 409);
      expect(await api('PUT', `/employees/${employee._id}`, { status: 'Inactive' }), 409);
      expect(await api('PATCH', `/allocations/${record._id}/return`, {}));
      expect(await api('DELETE', `/employees/${employee._id}`), 409);
      expect(await api('PUT', `/employees/${employee._id}`, { status: 'Inactive' }));
      assert.ok(!expect(await api('GET', '/employees/assignees', undefined, staffToken)).some(item => item._id === employee._id));
      expect(await api('POST', '/allocations', { assetId: asset._id, employeeId: employee._id }), 404);
    });
    for (const action of ['delete', 'deactivate']) {
      await t.test(`employee ${action} cannot race with an allocation`, async () => {
        for (let iteration = 0; iteration < 4; iteration++) {
          const employee = await newEmployee(); const asset = await newAsset();
          const results = await Promise.all([api('POST', '/allocations', { assetId: asset._id, employeeId: employee._id }),
            api(action === 'delete' ? 'DELETE' : 'PUT', `/employees/${employee._id}`, action === 'delete' ? undefined : { status: 'Inactive' })]);
          assert.ok(results.every(result => [200, 201, 404, 409].includes(result.status)), JSON.stringify(results));
          const assigned = await Allocation.exists({ employee: employee._id, allocationStatus: 'Allocated' });
          const savedEmployee = await Employee.findById(employee._id);
          if (assigned) assert.equal(savedEmployee?.status, 'Active');
        }
      });
    }
    await t.test('employee validation and duplicate updates return useful errors', async () => {
      expect(await api('POST', '/employees', { ...employeeBody(), email: 'invalid' }), 400);
      const a = await newEmployee(), b = await newEmployee();
      expect(await api('PUT', `/employees/${b._id}`, { email: a.email }), 409);
      expect(await api('PUT', `/employees/${b._id}`, { email: 'invalid' }), 400);
      expect(await api('DELETE', `/employees/${b._id}`));
    });
    await t.test('migration is dry-run by default, idempotent, explicit and preserves legacy identity', async () => {
      const employee = await newEmployee();
      const matchedUser = await User.create({ fullName: 'Historical login', email: employee.email, password: 'unused', role: 'IT Staff' });
      const asset = await newAsset();
      const legacy = await Allocation.create({ asset: asset._id, user: matchedUser._id, allocationDate: new Date(), allocationStatus: 'Returned' });
      assert.ok((await migrate()).mapped.some(item => item.allocation === legacy.id));
      assert.equal((await Allocation.findById(legacy.id)).employee, undefined);
      await migrate({ apply: true });
      const converted = await Allocation.findById(legacy.id);
      assert.equal(String(converted.employee), employee._id); assert.equal(String(converted.user), matchedUser.id);
      assert.equal((await migrate({ apply: true })).mapped.length, 0);
      const unmapped = await Allocation.create({ asset: asset._id, user: staff._id, allocationDate: new Date(), allocationStatus: 'Returned' });
      assert.ok((await migrate()).unresolved.some(item => item.allocation === unmapped.id));
      assert.equal(expect(await api('GET', `/allocations/${unmapped.id}`)).user.fullName, staff.fullName);
      const invalid = await migrate({ apply: true, mappings: { [unmapped.id]: String(new mongoose.Types.ObjectId()) } });
      assert.ok(invalid.unresolved.length > 0);
      await migrate({ apply: true, mappings: { [unmapped.id]: employee._id } });
      assert.equal(String((await Allocation.findById(unmapped.id)).employee), employee._id);
    });
    await t.test('legacy active assignments remain returnable without inventing employees', async () => {
      const asset = await newAsset();
      const record = await Allocation.create({ asset: asset._id, user: staff._id, allocationDate: new Date() });
      await Asset.updateOne({ _id: asset._id }, { status: 'Allocated' });
      expect(await api('PATCH', `/allocations/${record.id}/return`, {}));
      assert.equal((await Asset.findById(asset._id)).status, 'Available');
    });
    await t.test('QR creation/regeneration and backfill cannot leave deleted-asset references', async () => {
      for (const backfill of [false, true]) {
        for (let iteration = 0; iteration < 3; iteration++) {
          const asset = await newAsset(); await QRCode.deleteOne({ asset: asset._id });
          const results = await Promise.all([api('DELETE', `/assets/${asset._id}`), backfill ? api('GET', '/qr') : api('POST', `/qr/assets/${asset._id}/generate`, { regenerate: true })]);
          assert.ok(results.every(result => [200, 201, 404].includes(result.status)), JSON.stringify(results));
          assert.equal(await Asset.countDocuments({ _id: asset._id }), 0);
          assert.equal(await QRCode.countDocuments({ asset: asset._id }), 0);
        }
      }
    });

    if (process.env.QA_BROWSER === '1') {
      const { chromium } = require(process.env.QA_PLAYWRIGHT || 'playwright');
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      const page = await browser.newPage();
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ token, user }) => { localStorage.setItem('authToken', token); localStorage.setItem('currentUser', JSON.stringify(user)); }, { token, user: { _id: admin.id, role: 'Admin', fullName: admin.fullName } });
      await t.test('browser registers a company employee and allocates a device to that employee', async () => {
        await page.goto(`${origin}/users`);
        await page.getByRole('button', { name: 'Company Employee', exact: true }).click();
        const body = employeeBody();
        for (const [key, value] of Object.entries(body)) await page.locator(`[name=${key}]`).fill(value);
        const created = page.waitForResponse(response => response.url().endsWith('/api/employees') && response.request().method() === 'POST');
        await page.getByRole('button', { name: 'Register Employee', exact: true }).click();
        const response = await created; assert.equal(response.status(), 201);
        const employee = (await response.json()).data;
        const asset = await newAsset();
        await page.goto(`${origin}/allocations`);
        await page.getByRole('button', { name: 'New Allocation', exact: true }).click();
        await page.locator('[name=asset]').selectOption(asset._id);
        await page.locator('[name=employee]').selectOption(employee._id);
        await page.locator('button[type=submit]').click();
        const row = page.locator('tr').filter({ hasText: asset.assetName });
        await row.getByText(employee.fullName, { exact: true }).waitFor();
        await page.reload(); await row.getByText(employee.fullName, { exact: true }).waitFor();
      });
      await t.test('browser license fields survive save, reload and edit; decimal amounts work', async () => {
        await page.goto(`${origin}/licenses`);
        await page.getByRole('button', { name: 'Add License', exact: true }).click();
        for (const [key, value] of Object.entries({ softwareName: 'Browser License', vendor: 'Vendor', licenseKey: 'BROWSER-KEY', numberOfSeats: '10', assignedSeats: '3', cost: '12.50', notes: 'Browser notes' })) await page.locator(`[name=${key}]`).fill(value);
        await page.locator('[name=status]').selectOption('Expiring Soon');
        await page.locator('button[type=submit]').click();
        const row = page.locator('tr').filter({ hasText: 'Browser License' }); await row.waitFor();
        await page.reload(); await row.waitFor();
        assert.match(await row.innerText(), /Subscription/); assert.match(await row.innerText(), /3/); assert.match(await row.innerText(), /12.5/);
        await row.locator('button').first().click();
        assert.equal(await page.locator('[name=notes]').inputValue(), 'Browser notes');
        assert.equal(await page.locator('[name=assignedSeats]').inputValue(), '3');
        await page.locator('[name=cost]').fill('25.75'); await page.locator('button[type=submit]').click();
        await row.getByText('$25.75', { exact: true }).waitFor();
      });
      await t.test('browser maintenance accepts Upgrade and Cancelled, with decimal cost', async () => {
        const asset = await newAsset();
        await page.goto(`${origin}/maintainence`);
        await page.getByRole('button', { name: 'New Record', exact: true }).click();
        await page.locator('[name=asset]').selectOption(asset._id);
        await page.locator('[name=maintenanceType]').selectOption('Upgrade');
        await page.locator('[name=maintenanceDate]').fill('2026-09-26');
        await page.locator('[name=description]').fill('Browser upgrade');
        await page.locator('[name=cost]').fill('12.50');
        await page.locator('button[type=submit]').click();
        const row = page.locator('tr').filter({ hasText: asset.assetName }); await row.getByText('Upgrade', { exact: true }).waitFor();
        await page.reload(); await row.locator('button').first().click();
        assert.equal(await page.locator('[name=cost]').inputValue(), '12.5');
        await page.locator('[name=status]').selectOption('Cancelled');
        await page.locator('button[type=submit]').click();
        await row.getByText('Cancelled', { exact: true }).waitFor();
        assert.equal((await Asset.findById(asset._id)).status, 'Available');
        assert.deepEqual(errors, []);
      });
    }
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  }
});
