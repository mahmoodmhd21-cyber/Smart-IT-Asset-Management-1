const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/tmp/smart-it-qa-tools/node_modules/playwright');
const state = JSON.parse(fs.readFileSync('/tmp/smart-it-qa-state.json', 'utf8'));
const results = [];
let browser, page;
async function check(module, name, action) {
  try { results.push({ module, name, status: 'PASS', detail: await action() }); }
  catch (error) {
    const screenshot = `screenshots/control-${results.length + 1}.png`;
    await page.screenshot({ path: path.join(state.output, screenshot), fullPage: true });
    results.push({ module, name, status: 'FAIL', detail: error.message, screenshot });
  }
  console.log(`${results.at(-1).status} ${module}: ${name}`);
  fs.writeFileSync(path.join(state.output, 'control-results.json'), JSON.stringify(results, null, 2));
}
async function goto(route) { await page.goto(state.frontend + route, { waitUntil: 'networkidle' }); }
async function main() {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await goto('/');
  await page.locator('[name="email"]').fill(state.email);
  await page.locator('[name="password"]').fill(state.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  const navigation = await page.locator('.sidebar-nav a').evaluateAll((links) => links.map((link) => ({ label: link.getAttribute('aria-label'), href: link.getAttribute('href') })));
  for (const link of navigation) {
    await check('Navigation', `sidebar ${link.label} link`, async () => {
      await page.locator('.sidebar-nav').getByRole('link', { name: link.label, exact: true }).click();
      await page.waitForURL(state.frontend + link.href);
      assert.ok(await page.locator('main h1').isVisible());
    });
  }
  for (const [route, button] of [['/allocations', 'New Allocation'], ['/licenses', 'Add License'], ['/maintainence', 'New Record']]) {
    await check('Controls', `${route} modal Cancel button`, async () => {
      await goto(route); await page.getByRole('button', { name: button, exact: true }).click();
      await page.locator('form').getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await page.locator('form').count(), 0);
    });
    await check('Controls', `${route} modal close icon`, async () => {
      await page.getByRole('button', { name: button, exact: true }).click();
      await page.locator('form').locator('..').locator('button').first().click();
      assert.equal(await page.locator('form').count(), 0);
    });
    await check('Keyboard', `${route} modal traps keyboard focus`, async () => {
      await page.getByRole('button', { name: button, exact: true }).click();
      await page.locator('form button[type="submit"]').focus();
      await page.keyboard.press('Tab');
      if (route === '/allocations') await page.keyboard.press('Tab');
      const inside = await page.locator('form').locator('..').evaluate((modal) => modal.contains(document.activeElement));
      assert.ok(inside, 'Tab leaves the open modal instead of staying inside it');
    });
  }
  for (const [route, button] of [['/licenses', 'Add License'], ['/maintainence', 'New Record']]) {
    await check('Forms', `${route} accepts fractional currency amounts`, async () => {
      await goto(route); await page.getByRole('button', { name: button, exact: true }).click();
      const cost = page.locator('[name="cost"]');
      await cost.fill('12.50');
      assert.equal(await cost.evaluate((input) => input.validity.stepMismatch), false, 'Cost input has default integer step and blocks 12.50');
    });
  }
  await check('Forms', 'maintenance required description matches backend validation', async () => {
    await goto('/maintainence'); await page.getByRole('button', { name: 'New Record' }).click();
    assert.equal(await page.locator('[name="description"]').evaluate((input) => input.required), true, 'Backend requires description but the form does not mark or validate it as required');
  });
  await check('Forms', 'license required key matches backend validation', async () => {
    await goto('/licenses'); await page.getByRole('button', { name: 'Add License', exact: true }).click();
    assert.equal(await page.locator('[name="licenseKey"]').evaluate((input) => input.required), true, 'Backend requires licenseKey but the form does not mark or validate it as required');
  });
  await check('Assets', 'add form rejects whitespace-only name visibly', async () => {
    await goto('/assets/add'); await page.locator('[name="assetName"]').fill('   ');
    await page.getByRole('button', { name: 'Create Asset' }).click();
    await page.getByText('Asset name is required.', { exact: true }).waitFor();
  });
  await check('Users', 'duplicate user shows useful error', async () => {
    await goto('/users');
    await page.locator('[name="fullName"]').fill('QA duplicate');
    await page.locator('[name="email"]').fill(state.email);
    await page.locator('[name="password"]').fill(state.password);
    await page.getByRole('button', { name: 'Create User', exact: true }).click();
    await page.getByText('Email already exists.', { exact: true }).waitFor();
  });
  await check('Users', 'user edit/delete or disable controls exist', async () => {
    assert.ok(await page.getByRole('button', { name: /edit user|delete user|disable user|deactivate/i }).count(), 'User provisioning only supports creation; no account edit, revoke or delete controls');
  });
  await check('QR camera', 'test browser has a functioning synthetic video device', async () => {
    await goto('/qr-codes');
    const hasVideo = await page.evaluate(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const running = stream.getVideoTracks().some((track) => track.readyState === 'live');
      stream.getTracks().forEach((track) => track.stop());
      return running;
    });
    assert.ok(hasVideo);
  });
  await check('QR camera', 'Start camera preserves the rendered application', async () => {
    const crash = page.waitForEvent('pageerror', { timeout: 4000 }).then((error) => error.message).catch(() => null);
    await page.getByRole('button', { name: 'Start camera' }).click();
    const failure = await crash;
    assert.equal(failure, null, failure || 'Camera did not start');
    assert.ok(await page.locator('main').isVisible());
  });
  fs.writeFileSync(path.join(state.output, 'camera-errors.json'), JSON.stringify(errors, null, 2));
  await check('Responsive', 'user provisioning remains readable at 390px', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await goto('/users');
    const input = await page.locator('[name="fullName"]').boundingBox();
    assert.ok(input.width >= 120, `Full-name input shrinks to ${Math.round(input.width)}px in the fixed two-column layout`);
  });
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
