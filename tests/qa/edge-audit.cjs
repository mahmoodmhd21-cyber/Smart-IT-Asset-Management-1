const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const state = JSON.parse(fs.readFileSync('/tmp/smart-it-qa-state.json', 'utf8'));
const results = [];
let token;
let counter = 0;
async function api(method, endpoint, body) {
  const response = await fetch(state.api + endpoint, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
async function asset(status = 'Available') {
  const response = await api('POST', '/assets', { assetName: `QA edge device ${++counter}`, status });
  assert.equal(response.status, 201);
  return response.body.data;
}
async function repair(device) {
  const response = await api('POST', '/maintenance', { asset: device._id, maintenanceType: 'Repair', description: 'QA edge repair', maintenanceDate: '2026-09-24', status: 'In Progress' });
  assert.equal(response.status, 201);
  return response.body.data;
}
async function check(module, name, action) {
  try { results.push({ module, name, status: 'PASS', detail: await action() }); }
  catch (error) { results.push({ module, name, status: 'FAIL', detail: error.message }); }
  console.log(`${results.at(-1).status} ${module}: ${name}`);
  fs.writeFileSync(path.join(state.output, 'edge-results.json'), JSON.stringify(results, null, 2));
}
async function main() {
  token = (await api('POST', '/auth/login', { email: state.email, password: state.password })).body.token;
  assert.ok(token);
  await check('Concurrency', 'simultaneous allocations cannot double-book one asset', async () => {
    const device = await asset();
    const requests = await Promise.all(Array.from({ length: 8 }, () => api('POST', '/allocations', { assetId: device._id, employeeId: state.staffEmployeeId })));
    const records = (await api('GET', '/allocations')).body.data.filter((record) => record.asset?._id === device._id && record.allocationStatus === 'Allocated');
    assert.equal(records.length, 1, `Created ${records.length} active allocations; HTTP statuses: ${requests.map((r) => r.status).join(', ')}`);
  });
  await check('QR codes', 'QR status cannot release an actively allocated asset', async () => {
    const device = await asset();
    assert.equal((await api('POST', '/allocations', { assetId: device._id, employeeId: state.staffEmployeeId })).status, 201);
    const qr = (await api('POST', `/qr/assets/${device._id}/generate`, {})).body.data;
    const response = await api('PATCH', '/qr/status', { code: qr.token, status: 'Available' });
    assert.equal(response.status, 409, `Active assignment bypassed with HTTP ${response.status}`);
  });
  await check('Maintenance', 'reopening a completed job restores Maintenance status', async () => {
    const device = await asset('Maintenance');
    const record = await repair(device);
    assert.equal((await api('PUT', `/maintenance/${record._id}`, { status: 'Completed' })).status, 200);
    assert.equal((await api('PUT', `/maintenance/${record._id}`, { status: 'In Progress' })).status, 200);
    assert.equal((await api('GET', `/assets/${device._id}`)).body.data.status, 'Maintenance');
  });
  await check('Validation', 'blank asset name returns a client error', async () => {
    const response = await api('POST', '/assets', { assetName: '   ' });
    assert.equal(response.status, 400, `Validation returned HTTP ${response.status}`);
  });
  await check('Validation', 'invalid employee email rejected', async () => {
    const response = await api('POST', '/employees', { fullName: 'QA invalid email', employeeId: `QA-INVALID-${state.runId}`, email: 'not-an-email', department: 'QA', designation: 'Tester' });
    assert.equal(response.status, 400, `Invalid employee email accepted with HTTP ${response.status}`);
  });
  for (const endpoint of ['/assets/not-an-id', '/maintenance/not-an-id', '/allocations/not-an-id', '/licenses/not-an-id', '/employees/not-an-id']) {
    await check('Validation', `invalid ID ${endpoint}`, async () => { assert.equal((await api('GET', endpoint)).status, 400); });
  }
  await check('Deployment', 'backend start serves the built React dashboard', async () => {
    const response = await fetch(state.api.replace('/api', '/dashboard'), { signal: AbortSignal.timeout(5000) });
    const html = await response.text();
    assert.ok(response.status === 200 && html.includes('id="root"'), `Backend /dashboard returned HTTP ${response.status}; separate SPA hosting/reverse proxy is required`);
  });
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
