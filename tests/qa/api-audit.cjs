const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const statePath = '/tmp/smart-it-qa-state.json';
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const results = [];
let token;
let sequence = 0;

async function api(method, endpoint, body, credentials = token) {
  const response = await fetch(`${state.api}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(credentials ? { Authorization: `Bearer ${credentials}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function check(module, name, action) {
  try {
    const detail = await action();
    results.push({ module, name, status: 'PASS', detail });
  } catch (error) {
    results.push({ module, name, status: 'FAIL', detail: error.message });
  }
  console.log(`${results.at(-1).status} ${module}: ${name}`);
  fs.writeFileSync(path.join(state.output, 'api-results.json'), JSON.stringify(results, null, 2));
}

function status(response, expected) {
  assert.equal(response.status, expected, `Expected HTTP ${expected}; got ${response.status}: ${JSON.stringify(response.body)}`);
  return response.body.data;
}

async function asset(assetStatus = 'Available') {
  return status(await api('POST', '/assets', { assetName: `QA API device ${++sequence}`, status: assetStatus, category: 'Laptop' }), 201);
}
async function maintenance(device, extra = {}) {
  return status(await api('POST', '/maintenance', {
    asset: device._id, maintenanceType: 'Repair', description: 'QA maintenance',
    maintenanceDate: '2026-09-24', status: 'In Progress', ...extra,
  }), 201);
}
async function allocation(device) {
  return status(await api('POST', '/allocations', { assetId: device._id, employeeId: state.staffEmployeeId }), 201);
}
async function getAsset(device) { return status(await api('GET', `/assets/${device._id}`), 200); }

async function main() {
  // Only this freshly created, isolated QA database is ever targeted.
  assert.match(state.database, /^smart_it_qa_\d+$/);
  // The environment runner seeds the first administrator directly in its test DB.
  const login = await api('POST', '/auth/login', { email: state.email, password: state.password }, null);
  assert.equal(login.status, 200);
  token = login.body.token;
  const staffEmail = `qa-staff-${state.runId}@example.test`;
  const staff = await api('POST', '/auth/register', { fullName: 'QA IT Staff', email: staffEmail, password: state.password, role: 'IT Staff' });
  assert.equal(staff.status, 201);
  state.staffId = staff.body.user._id;
  state.staffEmployeeId = status(await api('POST', '/employees', { fullName: 'QA IT Staff', email: staffEmail, employeeId: `QA-STAFF-${state.runId}`, department: 'IT', designation: 'Technician' }), 201)._id;
  state.staffEmail = staffEmail;
  fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
  const staffLogin = await api('POST', '/auth/login', { email: staffEmail, password: state.password }, null);
  const staffToken = staffLogin.body.token;

  await check('Authentication', 'valid login and profile', async () => {
    const profile = await api('GET', '/auth/me');
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.role, 'Admin');
    assert.equal(profile.body.user.password, undefined);
  });
  await check('Authentication', 'invalid password rejected', async () => { status(await api('POST', '/auth/login', { email: state.email, password: 'incorrect' }, null), 401); });
  await check('Authentication', 'anonymous administrator registration blocked', async () => {
    const result = await api('POST', '/auth/register', { fullName: 'QA public admin', email: `qa-public-${state.runId}@example.test`, password: state.password, role: 'Admin' }, null);
    assert.ok([401, 403].includes(result.status), `Anonymous Admin creation returned HTTP ${result.status}`);
  });
  for (const endpoint of ['/assets', '/allocations', '/employees', '/licenses', '/maintenance', '/qr', '/auth/users']) {
    await check('Authorization', `anonymous GET ${endpoint} is rejected`, async () => {
      const response = await api('GET', endpoint, undefined, null);
      assert.ok([401, 403].includes(response.status), `Unauthenticated data access returned HTTP ${response.status}`);
    });
  }
  await check('Authorization', 'IT Staff cannot create an Admin', async () => {
    const response = await api('POST', '/auth/register', { fullName: 'QA escalated admin', email: `qa-escalated-${state.runId}@example.test`, password: state.password, role: 'Admin' }, staffToken);
    assert.equal(response.status, 403, `IT Staff created an Admin: HTTP ${response.status}`);
  });
  await check('Authorization', 'anonymous asset creation is rejected', async () => {
    const response = await api('POST', '/assets', { assetName: 'QA anonymous device' }, null);
    assert.ok([401, 403].includes(response.status), `Anonymous asset creation returned HTTP ${response.status}`);
  });
  const editable = await asset();
  await check('Authorization', 'anonymous asset update is rejected', async () => {
    const response = await api('PUT', `/assets/${editable._id}`, { location: 'QA unauthorized update' }, null);
    assert.ok([401, 403].includes(response.status), `Anonymous asset update returned HTTP ${response.status}`);
  });
  await check('Authorization', 'anonymous asset deletion is rejected', async () => {
    const response = await api('DELETE', `/assets/${editable._id}`, undefined, null);
    assert.ok([401, 403].includes(response.status), `Anonymous asset deletion returned HTTP ${response.status}`);
  });
  await check('Assets', 'asset create/read/update/delete and QR cleanup', async () => {
    const device = await asset();
    assert.equal((await getAsset(device)).assetName, device.assetName);
    const updated = status(await api('PUT', `/assets/${device._id}`, { assetName: 'QA edited', location: 'Lab' }), 200);
    assert.equal(updated.assetName, 'QA edited');
    const qrs = status(await api('GET', '/qr'), 200);
    assert.ok(qrs.some((q) => q.asset._id === device._id));
    status(await api('DELETE', `/assets/${device._id}`), 200);
    status(await api('GET', `/assets/${device._id}`), 404);
    assert.ok(!status(await api('GET', '/qr'), 200).some((q) => q.asset._id === device._id));
  });
  await check('Assets', 'serial number survives saving', async () => {
    const response = status(await api('POST', '/assets', { assetName: 'QA serial device', serialNumber: 'QA-SERIAL-001' }), 201);
    assert.equal(response.serialNumber, 'QA-SERIAL-001', 'serialNumber is silently discarded');
  });
  await check('Assets', 'invalid status returns validation error', async () => {
    const device = await asset();
    status(await api('PUT', `/assets/${device._id}`, { status: 'Invalid' }), 400);
  });
  await check('Allocations', 'allocate, prevent duplicates, return, delete', async () => {
    const device = await asset();
    const record = await allocation(device);
    assert.equal((await getAsset(device)).status, 'Allocated');
    status(await api('POST', '/allocations', { assetId: device._id, employeeId: state.staffEmployeeId }), 409);
    status(await api('DELETE', `/assets/${device._id}`), 409);
    status(await api('PATCH', `/allocations/${record._id}/return`), 200);
    assert.equal((await getAsset(device)).status, 'Available');
    status(await api('PATCH', `/allocations/${record._id}/return`), 409);
    status(await api('DELETE', `/allocations/${record._id}`), 200);
  });
  await check('Maintenance', 'completing last job restores Available', async () => {
    const device = await asset('Maintenance');
    const record = await maintenance(device);
    status(await api('PUT', `/maintenance/${record._id}`, { status: 'Completed' }), 200);
    assert.equal((await getAsset(device)).status, 'Available');
  });
  await check('Maintenance', 'another unfinished job prevents release', async () => {
    const device = await asset('Maintenance');
    const first = await maintenance(device);
    await maintenance(device, { status: 'Scheduled' });
    status(await api('PUT', `/maintenance/${first._id}`, { status: 'Completed' }), 200);
    assert.equal((await getAsset(device)).status, 'Maintenance');
    status(await api('PUT', `/assets/${device._id}`, { status: 'Available' }), 409);
  });
  for (const workStatus of ['Scheduled', 'In Progress']) {
    await check('Maintenance', `${workStatus} maintenance makes device unavailable`, async () => {
      const device = await asset();
      await maintenance(device, { status: workStatus });
      assert.equal((await getAsset(device)).status, 'Maintenance');
    });
  }
  for (const maintenanceType of ['Repair', 'Upgrade', 'Inspection', 'Replacement', 'Cleaning']) {
    await check('Maintenance', `form option ${maintenanceType} is accepted`, async () => {
      await maintenance(await asset('Maintenance'), { maintenanceType });
    });
  }
  await check('Maintenance', 'Cancelled option is accepted', async () => {
    const record = await maintenance(await asset('Maintenance'));
    status(await api('PUT', `/maintenance/${record._id}`, { status: 'Cancelled' }), 200);
  });
  await check('Maintenance', 'returning an allocation preserves ongoing maintenance', async () => {
    const device = await asset();
    const allocated = await allocation(device);
    status(await api('PUT', `/assets/${device._id}`, { status: 'Maintenance' }), 200);
    await maintenance(device);
    status(await api('PATCH', `/allocations/${allocated._id}/return`), 200);
    assert.equal((await getAsset(device)).status, 'Maintenance');
  });
  await check('Maintenance', 'deleting allocation preserves ongoing maintenance', async () => {
    const device = await asset();
    const allocated = await allocation(device);
    status(await api('PUT', `/assets/${device._id}`, { status: 'Maintenance' }), 200);
    await maintenance(device);
    status(await api('DELETE', `/allocations/${allocated._id}`), 200);
    assert.equal((await getAsset(device)).status, 'Maintenance');
  });
  await check('QR codes', 'status endpoint respects unfinished maintenance', async () => {
    const device = await asset('Maintenance');
    await maintenance(device);
    const code = status(await api('POST', `/qr/assets/${device._id}/generate`, {}), 200);
    const response = await api('PATCH', '/qr/status', { code: code.token, status: 'Available' });
    assert.equal(response.status, 409, `QR endpoint released device: HTTP ${response.status}`);
  });
  await check('Maintenance', 'deleting asset cannot orphan maintenance', async () => {
    const device = await asset('Maintenance');
    const record = await maintenance(device);
    const deleted = await api('DELETE', `/assets/${device._id}`);
    const retained = await api('GET', `/maintenance/${record._id}`);
    assert.ok(deleted.status === 409 || retained.status === 404, `Delete returned ${deleted.status}; maintenance still exists with asset=${JSON.stringify(retained.body.data?.asset)}`);
  });
  await check('Maintenance', 'nonexistent asset reference is rejected', async () => {
    const response = await api('POST', '/maintenance', { asset: '000000000000000000000999', maintenanceType: 'Repair', description: 'Missing device', maintenanceDate: '2026-09-24' });
    assert.ok([400, 404].includes(response.status), `Orphan maintenance created: HTTP ${response.status}`);
  });
  const employeeBody = { fullName: 'QA API Employee', email: `qa-person-${state.runId}@example.test`, employeeId: `QA-${state.runId}`, department: 'QA', designation: 'Tester', status: 'Active' };
  const person = status(await api('POST', '/employees', employeeBody), 201);
  await check('Employees', 'employee update and duplicate validation', async () => {
    status(await api('POST', '/employees', employeeBody), 409);
    assert.equal(status(await api('PUT', `/employees/${person._id}`, { status: 'Inactive' }), 200).status, 'Inactive');
  });
  await check('Employees', 'company employees can receive allocations', async () => {
    const device = await asset();
    // The preceding check deactivated this employee: verify the guard before reactivation.
    status(await api('POST', '/allocations', { assetId: device._id, employeeId: person._id }), 404);
    status(await api('PUT', `/employees/${person._id}`, { status: 'Active' }), 200);
    const record = status(await api('POST', '/allocations', { assetId: device._id, employeeId: person._id }), 201);
    status(await api('DELETE', `/employees/${person._id}`), 409);
    status(await api('PATCH', `/allocations/${record._id}/return`), 200);
    status(await api('DELETE', `/allocations/${record._id}`), 200);
  });
  await check('Employees', 'delete employee', async () => { status(await api('DELETE', `/employees/${person._id}`), 200); });
  const license = status(await api('POST', '/licenses', { softwareName: 'QA API License', vendor: 'QA', licenseKey: `QA-KEY-${state.runId}`, numberOfSeats: 10, assignedSeats: 3, licenseType: 'Subscription', cost: 99, notes: 'QA notes', status: 'Active' }), 201);
  await check('Licenses', 'all form fields persist', async () => {
    assert.equal(license.assignedSeats, 3, 'assignedSeats was discarded; backend uses assignedSeats');
    assert.equal(license.licenseType, 'Subscription');
    assert.equal(license.cost, 99);
    assert.equal(license.notes, 'QA notes');
  });
  await check('Licenses', 'Expiring Soon form option is accepted', async () => { status(await api('PUT', `/licenses/${license._id}`, { status: 'Expiring Soon' }), 200); });
  await check('Licenses', 'seat usage cannot exceed licensed seats', async () => {
    const response = await api('PUT', `/licenses/${license._id}`, { assignedSeats: 11 });
    assert.equal(response.status, 400, `11 assigned seats for a 10-seat license accepted: HTTP ${response.status}`);
  });
  await check('Licenses', 'edit supported fields and delete', async () => {
    assert.equal(status(await api('PUT', `/licenses/${license._id}`, { softwareName: 'QA renamed license' }), 200).softwareName, 'QA renamed license');
    status(await api('DELETE', `/licenses/${license._id}`), 200);
  });
  console.log(`API audit complete: ${results.filter((r) => r.status === 'PASS').length}/${results.length} passed.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
