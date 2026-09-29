const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/tmp/smart-it-qa-tools/node_modules/playwright');
const AxeBuilder = require('/tmp/smart-it-qa-tools/node_modules/@axe-core/playwright').default;
const state = JSON.parse(fs.readFileSync('/tmp/smart-it-qa-state.json', 'utf8'));
const results = [];
const errors = [];
const accessibility = [];
const layouts = [];
let page, browser, context, token;
let acceptDialogs = true;
let sequence = 0;
const screenshotDirectory = path.join(state.output, 'screenshots');
fs.mkdirSync(screenshotDirectory, { recursive: true });

async function api(method, endpoint, data) {
  const response = await fetch(`${state.api}${endpoint}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(8000),
  });
  const body = await response.json();
  assert.ok(response.ok, `Fixture ${method} ${endpoint} failed: ${JSON.stringify(body)}`);
  return body.data ?? body;
}

async function check(module, name, action) {
  const started = Date.now();
  try {
    const detail = await action();
    results.push({ module, name, status: 'PASS', detail, ms: Date.now() - started });
  } catch (error) {
    const result = { module, name, status: 'FAIL', detail: error.message.slice(0, 2200), ms: Date.now() - started };
    if (page && !page.isClosed()) {
      const file = `failure-${results.length + 1}.png`;
      await page.screenshot({ path: path.join(screenshotDirectory, file), fullPage: true, timeout: 5000 }).catch(() => {});
      result.screenshot = `screenshots/${file}`;
    }
    results.push(result);
  }
  console.log(`${results.at(-1).status} ${module}: ${name}`);
  fs.writeFileSync(path.join(state.output, 'frontend-results.json'), JSON.stringify(results, null, 2));
}

async function goto(route) {
  await page.goto(`${state.frontend}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.locator('h1').waitFor();
}
async function fill(name, value) { await page.locator(`[name="${name}"]`).fill(String(value)); }
async function select(name, value) { await page.locator(`select[name="${name}"]`).selectOption(value); }
async function submit(method, endpoint, action) {
  // Observe both promises immediately so a failed click cannot leave an unhandled timeout.
  const [response] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === `/api${endpoint}` && response.request().method() === method, { timeout: 8000 }),
    action(),
  ]);
  return { status: response.status(), body: await response.json() };
}
function ok(response, expected = 200) {
  assert.equal(response.status, expected, `HTTP ${response.status}: ${JSON.stringify(response.body)}`);
  return response.body.data;
}
async function newAsset(status = 'Available') {
  return api('POST', '/assets', { assetName: `QA browser fixture ${++sequence}`, category: 'Laptop', status });
}
async function maintenanceForm(device, type = 'Repair', status = 'In Progress') {
  await goto('/maintainence');
  await page.getByRole('button', { name: 'New Record', exact: true }).click();
  await select('asset', device._id);
  await select('maintenanceType', type);
  await select('status', status);
  await fill('maintenanceDate', '2026-09-24');
  await fill('description', 'QA browser maintenance');
}
async function login(email = state.email, destination = '/dashboard') {
  await goto('/');
  if (destination === '/dashboard') {
    await page.evaluate(() => history.replaceState(null, '', location.href));
    await page.reload({ waitUntil: 'networkidle' });
  }
  await fill('email', email);
  await fill('password', state.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL(`**${destination}`);
  token = await page.evaluate(() => localStorage.getItem('authToken'));
}

async function main() {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on('dialog', (dialog) => acceptDialogs ? dialog.accept() : dialog.dismiss());
  page.on('pageerror', (error) => errors.push({ url: page.url(), type: 'pageerror', message: error.message }));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push({ url: page.url(), type: 'console', message: message.text() });
  });

  await check('Login', 'protected pages redirect without a session', async () => {
    await goto('/assets');
    assert.equal(new URL(page.url()).pathname, '/');
  });
  await check('Login', 'required credentials prevent empty submission', async () => {
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    assert.equal(await page.locator('input[name="email"]').evaluate((input) => input.validity.valueMissing), true);
  });
  await check('Login', 'invalid credentials display an error', async () => {
    await fill('email', state.email); await fill('password', 'incorrect');
    const response = await submit('POST', '/auth/login', () => page.getByRole('button', { name: 'Sign In', exact: true }).click());
    assert.equal(response.status, 401);
    await page.getByText('Invalid email or password.', { exact: true }).waitFor();
  });
  await check('Login', 'show-password control is available', async () => {
    assert.ok(await page.getByRole('button', { name: /show password/i }).count() || await page.getByRole('checkbox', { name: /show password/i }).count(), 'No show-password control exists');
  });
  await check('Login', 'valid credentials restore the requested asset route', () => login(state.email, '/assets'));
  if (!token) throw new Error('Cannot continue authenticated UI tests without a successful login');

  const routes = ['/dashboard', '/assets', '/assets/add', '/allocations', '/users', '/employees', '/licenses', '/maintainence', '/qr-codes', '/profile'];
  for (const route of routes) {
    await check('Navigation', `load and refresh ${route}`, async () => {
      await goto(route); await page.reload({ waitUntil: 'networkidle' });
      assert.ok(await page.locator('main h1').isVisible());
      assert.equal(new URL(page.url()).pathname, route);
    });
  }
  await check('Sidebar', 'collapse, persist across navigation, expand with keyboard', async () => {
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await page.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().width === 72);
    assert.equal(await page.locator('.sidebar-link span').count(), 0);
    await page.getByRole('link', { name: 'Assets', exact: true }).click();
    assert.equal(await page.locator('aside').getAttribute('data-collapsed'), 'true');
    await page.getByRole('button', { name: 'Expand sidebar' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().width === 240);
    assert.ok(await page.locator('.sidebar-link span').count() > 0);
  });
  let device;
  await check('Assets', 'create asset through form', async () => {
    await goto('/assets/add');
    await fill('assetName', 'QA UI Laptop'); await select('category', 'Laptop');
    await fill('brand', 'QA Brand'); await fill('model', 'QA Model'); await fill('location', 'QA Lab');
    await fill('purchaseDate', '2026-09-01');
    device = ok(await submit('POST', '/assets', () => page.getByRole('button', { name: 'Create Asset', exact: true }).click()), 201);
    await page.waitForURL('**/assets');
    await page.getByRole('row').filter({ hasText: 'QA UI Laptop' }).waitFor();
  });
  if (!device) device = await newAsset();
  await check('Assets', 'edit form is prefilled and persists updates', async () => {
    await goto(`/assets/${device._id}/edit`);
    assert.equal(await page.locator('[name="assetName"]').inputValue(), device.assetName);
    await fill('assetName', 'QA UI Laptop Updated');
    ok(await submit('PUT', `/assets/${device._id}`, () => page.getByRole('button', { name: 'Save Changes' }).click()));
    await page.waitForURL('**/assets');
    assert.equal((await api('GET', `/assets/${device._id}`)).assetName, 'QA UI Laptop Updated');
  });
  await check('Assets', 'search and status filter work', async () => {
    await goto('/assets');
    await page.getByPlaceholder('Search assets...').fill('QA UI Laptop Updated');
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.locator('main select').selectOption('Retired');
    await page.getByText('No assets found', { exact: true }).waitFor();
  });
  await check('Assets', 'cancel does not create an asset', async () => {
    const before = (await api('GET', '/assets')).length;
    await goto('/assets/add'); await fill('assetName', 'QA cancelled asset');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    assert.equal((await api('GET', '/assets')).length, before);
  });
  await check('Assets', 'serial number can be entered', async () => {
    await goto('/assets/add');
    assert.ok(await page.locator('[name="serialNumber"]').count(), 'Serial Number field is missing');
  });

  let allocated;
  await check('Allocations', 'allocate through modal', async () => {
    await goto('/allocations');
    await page.getByRole('button', { name: 'New Allocation' }).click();
    await select('asset', device._id); await select('employee', state.staffEmployeeId);
    allocated = ok(await submit('POST', '/allocations', () => page.getByRole('button', { name: 'Create Allocation' }).click()), 201);
    assert.equal((await api('GET', `/assets/${device._id}`)).status, 'Allocated');
  });
  await check('Allocations', 'return action restores availability', async () => {
    await goto('/allocations');
    const row = page.getByRole('row').filter({ hasText: 'QA UI Laptop Updated' });
    ok(await submit('PATCH', `/allocations/${allocated._id}/return`, () => row.getByTitle('Return', { exact: true }).click()));
    assert.equal((await api('GET', `/assets/${device._id}`)).status, 'Available');
  });
  await check('Allocations', 'delete returned allocation', async () => {
    await goto('/allocations');
    ok(await submit('DELETE', `/allocations/${allocated._id}`, () => page.getByRole('row').filter({ hasText: 'QA UI Laptop Updated' }).getByTitle('Delete', { exact: true }).click()));
    assert.ok(!(await api('GET', '/allocations')).some((record) => record._id === allocated._id));
  });
  await check('Allocations', 'deleting active allocation refreshes available-asset dropdown', async () => {
    const fresh = await newAsset();
    const record = await api('POST', '/allocations', { assetId: fresh._id, employeeId: state.staffEmployeeId });
    await goto('/allocations');
    ok(await submit('DELETE', `/allocations/${record._id}`, () => page.getByRole('row').filter({ hasText: fresh.assetName }).getByTitle('Delete', { exact: true }).click()));
    await page.getByRole('button', { name: 'New Allocation' }).click();
    const options = await page.locator('select[name="asset"] option').evaluateAll((nodes) => nodes.map((n) => n.value));
    assert.ok(options.includes(fresh._id), 'Returned-to-available asset is absent until a page refresh');
  });

  let repair;
  await check('Maintenance', 'create Repair through form', async () => {
    await maintenanceForm(device);
    repair = ok(await submit('POST', '/maintenance', () => page.getByRole('button', { name: 'Create Record' }).click()), 201);
  });
  await check('Maintenance', 'starting maintenance updates the Assets page', async () => {
    await goto('/assets');
    const row = page.getByRole('row').filter({ hasText: 'QA UI Laptop Updated' });
    assert.match(await row.innerText(), /Maintenance/);
  });
  await check('Maintenance', 'manual availability is blocked with a visible error', async () => {
    await goto(`/assets/${device._id}/edit`); await select('status', 'Available');
    const response = await submit('PUT', `/assets/${device._id}`, () => page.getByRole('button', { name: 'Save Changes' }).click());
    assert.equal(response.status, 409);
    await page.getByText(/unfinished maintenance/).waitFor();
  });
  await check('Maintenance', 'complete repair through modal updates linked asset', async () => {
    await api('PUT', `/assets/${device._id}`, { status: 'Maintenance' });
    await goto('/maintainence');
    await page.getByRole('row').filter({ hasText: 'QA UI Laptop Updated' }).locator('button').first().click();
    await select('status', 'Completed');
    ok(await submit('PUT', `/maintenance/${repair._id}`, () => page.getByRole('button', { name: 'Update', exact: true }).click()));
    assert.equal((await api('GET', `/assets/${device._id}`)).status, 'Available');
  });
  for (const type of ['Upgrade', 'Inspection', 'Replacement', 'Cleaning']) {
    await check('Maintenance', `${type} form option saves successfully`, async () => {
      await maintenanceForm(device, type);
      ok(await submit('POST', '/maintenance', () => page.getByRole('button', { name: 'Create Record' }).click()), 201);
    });
  }
  await check('Maintenance', 'Cancelled form option saves successfully', async () => {
    await maintenanceForm(device, 'Repair', 'Cancelled');
    ok(await submit('POST', '/maintenance', () => page.getByRole('button', { name: 'Create Record' }).click()), 201);
  });
  await check('Maintenance', 'status filter and delete completed record', async () => {
    await goto('/maintainence');
    await page.getByRole('button', { name: /^Completed/ }).click();
    const row = page.getByRole('row').filter({ hasText: 'QA UI Laptop Updated' });
    assert.match(await row.innerText(), /Completed/);
    ok(await submit('DELETE', `/maintenance/${repair._id}`, () => row.locator('button').last().click()));
  });
  await check('Maintenance', 'Escape closes the maintenance modal', async () => {
    await maintenanceForm(device);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('form').count(), 0, 'Modal stays open after Escape');
  });

  await check('Users', 'create system user via form', async () => {
    await goto('/users');
    await fill('fullName', 'QA UI System User'); await fill('email', `qa-ui-user-${state.runId}@example.test`); await fill('password', state.password);
    const response = await submit('POST', '/auth/register', () => page.getByRole('button', { name: 'Create User', exact: true }).click());
    assert.equal(response.status, 201);
    await page.getByText('QA UI System User', { exact: true }).waitFor();
  });
  await check('Users', 'successful creation shows confirmation', async () => {
    assert.ok((await page.locator('main').innerText()).includes('created successfully'), 'Success message is cleared by loadData immediately');
  });
  const employeeName = 'QA UI Company Employee';
  await check('Employees', 'register company employee via form', async () => {
    await goto('/users'); await page.getByRole('button', { name: 'Company Employee', exact: true }).click();
    for (const [name, value] of Object.entries({ fullName: employeeName, employeeId: `QA-UI-${state.runId}`, email: `qa-ui-person-${state.runId}@example.test`, department: 'QA', designation: 'Tester' })) await fill(name, value);
    ok(await submit('POST', '/employees', () => page.getByRole('button', { name: 'Register Employee', exact: true }).click()), 201);
    await goto('/employees'); await page.getByText(employeeName, { exact: true }).waitFor();
  });
  await check('Employees', 'search and status filters', async () => {
    await page.getByPlaceholder(/Search by name/).fill(employeeName);
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByRole('button', { name: /Inactive Employees/ }).click();
    await page.getByText('No employees found.', { exact: true }).waitFor();
  });
  await check('Employees', 'registered employee appears in allocation options', async () => {
    await goto('/allocations'); await page.getByRole('button', { name: 'New Allocation' }).click();
    assert.ok((await page.locator('select[name="employee"]').innerText()).includes(employeeName), 'Allocation uses system users, not the company employee directory');
  });
  await check('Employees', 'employee edit and delete controls exist', async () => {
    await goto('/employees');
    assert.ok(await page.locator('tbody button, tbody a').count(), 'Personnel Directory contains no edit or delete controls');
  });

  let license;
  await check('Licenses', 'create license through form', async () => {
    await goto('/licenses'); await page.getByRole('button', { name: 'Add License', exact: true }).click();
    await fill('softwareName', 'QA UI Software'); await fill('vendor', 'QA Vendor'); await fill('licenseKey', `QA-UI-KEY-${state.runId}`);
    await fill('numberOfSeats', 10); await fill('assignedSeats', 3); await fill('cost', 99); await fill('notes', 'QA notes');
    license = ok(await submit('POST', '/licenses', () => page.locator('form button[type="submit"]').click()), 201);
    await page.getByRole('row').filter({ hasText: 'QA UI Software' }).waitFor();
  });
  await check('Licenses', 'type, usage, cost and notes survive reload', async () => {
    await goto('/licenses');
    const row = page.getByRole('row').filter({ hasText: 'QA UI Software' });
    assert.match(await row.innerText(), /Subscription/);
    assert.match(await row.innerText(), /3\s*\/10/);
    assert.match(await row.innerText(), /99/);
  });
  await check('Licenses', 'edit software name', async () => {
    await goto('/licenses');
    await page.getByRole('row').filter({ hasText: 'QA UI Software' }).locator('button').first().click();
    await fill('softwareName', 'QA UI Software Updated');
    ok(await submit('PUT', `/licenses/${license._id}`, () => page.getByRole('button', { name: 'Update', exact: true }).click()));
  });
  await check('Licenses', 'Expiring Soon saves through form', async () => {
    await goto('/licenses'); await page.getByRole('row').filter({ hasText: 'QA UI Software Updated' }).locator('button').first().click();
    await select('status', 'Expiring Soon');
    ok(await submit('PUT', `/licenses/${license._id}`, () => page.getByRole('button', { name: 'Update', exact: true }).click()));
  });
  await check('Licenses', 'delete license', async () => {
    await goto('/licenses');
    ok(await submit('DELETE', `/licenses/${license._id}`, () => page.getByRole('row').filter({ hasText: 'QA UI Software Updated' }).locator('button').last().click()));
  });

  let qr;
  await check('QR codes', 'image renders, View selects asset and Download PNG works', async () => {
    await goto('/qr-codes');
    await page.getByRole('row').filter({ hasText: 'QA UI Laptop Updated' }).getByRole('button', { name: 'View' }).click();
    await page.waitForFunction(() => { const image = document.querySelector('main img'); return image?.complete && image.naturalWidth > 0; });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download PNG' }).click();
    const download = await downloadPromise;
    await download.saveAs(path.join(state.output, 'qa-label.png'));
    assert.match(download.suggestedFilename(), /\.png$/);
    qr = (await api('GET', '/qr')).find((record) => record.asset._id === device._id);
  });
  await check('QR codes', 'invalid lookup displays error', async () => {
    await page.getByPlaceholder('Paste a QR URL or token').fill('invalid');
    await page.getByRole('button', { name: 'Retrieve', exact: true }).click();
    await page.getByText('Invalid QR code', { exact: true }).waitFor();
  });
  await check('QR codes', 'manual lookup and status update', async () => {
    if (!qr) qr = (await api('GET', '/qr')).find((record) => record.asset._id === device._id);
    await goto('/qr-codes'); await page.getByPlaceholder('Paste a QR URL or token').fill(qr.token);
    await page.getByRole('button', { name: 'Retrieve', exact: true }).click();
    await page.getByRole('heading', { name: 'QA UI Laptop Updated' }).waitFor();
    // This device already has open maintenance from the preceding workflow.
    await page.locator('select').last().selectOption('Retired');
    ok(await submit('PATCH', '/qr/status', () => page.getByRole('button', { name: 'Update status' }).click()));
    assert.equal((await api('GET', `/assets/${device._id}`)).status, 'Retired');
  });
  await check('QR codes', 'regenerate invalidates previous token', async () => {
    await page.locator('#qr-asset').selectOption(device._id);
    ok(await submit('POST', `/qr/assets/${device._id}/generate`, () => page.getByRole('button', { name: 'Regenerate', exact: true }).click()));
    await page.getByPlaceholder('Paste a QR URL or token').fill(qr.token);
    const response = await submit('POST', '/qr/scan', () => page.getByRole('button', { name: 'Retrieve', exact: true }).click());
    assert.equal(response.status, 404);
  });
  await check('QR codes', 'camera start and stop using synthetic test camera', async () => {
    await goto('/qr-codes'); await page.getByRole('button', { name: 'Start camera' }).click();
    await page.locator('[id^="qr-reader-"] video').waitFor();
    await page.getByRole('button', { name: 'Stop camera' }).click();
    await page.getByText('Camera is off', { exact: true }).waitFor();
  });
  await check('Profile', 'name email and role displayed', async () => {
    await goto('/profile');
    const text = await page.locator('main').innerText();
    assert.ok(text.includes('QA Administrator') && text.includes(state.email) && text.includes('Admin'));
  });

  for (const route of ['/dashboard', '/assets', '/assets/add', '/allocations', '/users', '/employees', '/licenses', '/maintainence', '/qr-codes', '/profile']) {
    await check('Accessibility', `WCAG A/AA automated scan ${route}`, async () => {
      await goto(route);
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const violations = scan.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target, failureSummary: n.failureSummary })) }));
      accessibility.push({ route, violations });
      fs.writeFileSync(path.join(state.output, 'accessibility.json'), JSON.stringify(accessibility, null, 2));
      assert.equal(violations.length, 0, violations.map((v) => `${v.id}: ${v.nodes.length} elements (${v.impact})`).join('; '));
    });
  }
  for (const width of [1440, 1024, 768, 390]) {
    for (const route of ['/dashboard', '/assets', '/assets/add', '/users', '/employees', '/licenses', '/maintainence', '/qr-codes', '/profile']) {
      await check('Responsive', `${route} at ${width}px`, async () => {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
        await page.evaluate(() => localStorage.removeItem('sidebarCollapsed'));
        await goto(route); await page.mouse.move(0, 0);
        const dimensions = await page.evaluate(() => ({
          viewport: innerWidth,
          document: document.documentElement.scrollWidth,
          clippedTables: Array.from(document.querySelectorAll('table')).filter((table) => {
            const parent = table.parentElement;
            return getComputedStyle(parent).overflowX === 'hidden' && table.scrollWidth > parent.clientWidth + 2;
          }).length,
        }));
        layouts.push({ route, width, ...dimensions });
        const file = `${route.replaceAll('/', '') || 'login'}-${width}.png`;
        await page.screenshot({ path: path.join(screenshotDirectory, file), fullPage: true });
        fs.writeFileSync(path.join(state.output, 'layouts.json'), JSON.stringify(layouts, null, 2));
        assert.ok(dimensions.document <= width + 2, `Document overflows: ${dimensions.document}px for ${width}px viewport`);
        assert.equal(dimensions.clippedTables, 0, 'Table overflows a container with hidden horizontal overflow');
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of ['/licenses', '/maintainence', '/employees', '/dashboard', '/profile']) {
    await check('Error handling', `${route} visibly reports API failure`, async () => {
      await page.route('**/api/**', (request) => request.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA service unavailable' }) }));
      try {
        await goto(route);
        assert.match(await page.locator('main').innerText(), /QA service unavailable|failed|unable|error|retry/i, 'API failure is hidden as empty data or stale data');
      } finally { await page.unroute('**/api/**'); }
    });
  }
  await check('Assets', 'delete confirmation can be cancelled', async () => {
    await goto('/assets'); acceptDialogs = false;
    try { await page.getByRole('row').filter({ hasText: 'QA UI Laptop Updated' }).getByTitle('Delete', { exact: true }).click(); }
    finally { acceptDialogs = true; }
    assert.ok(await api('GET', `/assets/${device._id}`));
  });
  await check('Assets', 'delete asset through UI', async () => {
    await goto('/assets');
    ok(await submit('DELETE', `/assets/${device._id}`, () => page.getByRole('row').filter({ hasText: 'QA UI Laptop Updated' }).getByTitle('Delete', { exact: true }).click()), 409);
    const removable = await newAsset();
    await goto('/assets');
    ok(await submit('DELETE', `/assets/${removable._id}`, () => page.getByRole('row').filter({ hasText: removable.assetName }).getByTitle('Delete', { exact: true }).click()));
    assert.ok(!(await api('GET', '/assets')).some((asset) => asset._id === removable._id));
  });
  await check('Roles', 'IT Staff cannot access user provisioning', async () => {
    await login(state.staffEmail); await goto('/users');
    assert.equal(new URL(page.url()).pathname, '/dashboard');
  });
  await check('Roles', 'IT Staff cannot open hidden employee administration route', async () => {
    await goto('/employees');
    assert.notEqual(new URL(page.url()).pathname, '/employees', 'Sidebar hides Employees, but direct URL is allowed');
  });
  await check('Session', 'invalid token redirects to login', async () => {
    await page.evaluate(() => localStorage.setItem('authToken', 'invalid-token'));
    await goto('/assets');
    assert.equal(new URL(page.url()).pathname, '/', 'Expired or invalid session remains inside the application');
  });
  await check('Session', 'logout clears session and protects routes', async () => {
    await login(); await page.getByRole('button', { name: 'Sign Out' }).click();
    await page.waitForURL(state.frontend + '/');
    assert.equal(await page.evaluate(() => localStorage.getItem('authToken')), null);
    await goto('/profile'); assert.equal(new URL(page.url()).pathname, '/');
  });
  await check('Accessibility', 'login form automated accessibility', async () => {
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    accessibility.push({ route: '/', violations: scan.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target })) })) });
    fs.writeFileSync(path.join(state.output, 'accessibility.json'), JSON.stringify(accessibility, null, 2));
    assert.equal(scan.violations.length, 0, scan.violations.map((v) => v.id).join(', '));
  });
  fs.writeFileSync(path.join(state.output, 'browser-errors.json'), JSON.stringify(errors, null, 2));
  console.log(`Browser audit complete: ${results.filter((r) => r.status === 'PASS').length}/${results.length} passed.`);
}

main().catch((error) => {
  console.error(error);
  fs.writeFileSync(path.join(state.output, 'browser-fatal.txt'), error.stack || error.message);
  process.exitCode = 1;
}).finally(async () => {
  fs.writeFileSync(path.join(state.output, 'browser-errors.json'), JSON.stringify(errors, null, 2));
  if (browser) await browser.close();
});
