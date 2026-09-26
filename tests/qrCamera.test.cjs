const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(process.env.QA_APP_ROOT || path.join(__dirname, '..'));
const express = require(path.join(root, 'node_modules/express'));
const { chromium } = require(process.env.QA_PLAYWRIGHT || '/tmp/smart-it-qa-tools/node_modules/playwright');

// Real built React app and html5-qrcode, with synthetic media and isolated API fixtures.
// These tests do not access the development database or claim physical-camera coverage.
test('Step 4 QR camera lifecycle', { timeout: 120000 }, async t => {
  let server, browser;
  try {
    const app = express();
    app.use(express.static(path.join(root, 'frontend/dist')));
    app.get('*', (_, res) => res.sendFile(path.join(root, 'frontend/dist/index.html')));
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    async function open() {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', route => route.fulfill({ json: { success: true, data: [] } }));
      await page.addInitScript(() => {
        localStorage.setItem('authToken', 'isolated-browser-test');
        localStorage.setItem('currentUser', JSON.stringify({ fullName: 'Camera QA', role: 'Admin' }));
        window.cameraTracks = [];
        window.cameraCalls = 0;
        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async constraints => {
          window.cameraCalls++;
          if (window.cameraFailure) throw new DOMException(window.cameraFailure, window.cameraFailure);
          if (window.delayCamera) await new Promise(resolve => { window.releaseCamera = resolve; });
          let stream;
          if (window.qrData) {
            const image = new Image(); image.src = window.qrData;
            await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
            const context = canvas.getContext('2d');
            const draw = () => { context.fillStyle = 'white'; context.fillRect(0, 0, 640, 480); context.drawImage(image, 160, 80, 320, 320); };
            draw(); stream = canvas.captureStream(10); setInterval(draw, 100);
          } else stream = await original(constraints);
          window.cameraTracks.push(...stream.getTracks());
          return stream;
        };
      });
      await page.goto(`${origin}/qr-codes`);
      await page.getByRole('button', { name: 'Start camera', exact: true }).waitFor();
      return { page, errors };
    }
    async function running(page) {
      await page.waitForFunction(() => {
        const video = document.querySelector('video');
        return video && video.readyState >= 2 && video.videoWidth > 0 && !document.body.textContent.includes('Starting camera...');
      });
    }
    async function stopped(page) {
      try {
        await page.waitForFunction(() => window.cameraTracks.length > 0 && window.cameraTracks.every(track => track.readyState === 'ended'));
      } catch (error) {
        throw new Error(`${error.message}; ${JSON.stringify(await page.evaluate(() => ({ calls: window.cameraCalls, tracks: window.cameraTracks.map(t => t.readyState), text: document.body.innerText })))}`);
      }
    }
    await t.test('repeated starts, duplicate clicks, stop and responsive camera rendering', async () => {
      const { page, errors } = await open();
      try {
        for (const width of [1440, 1024, 768]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.getByRole('button', { name: 'Start camera', exact: true }).evaluate(button => { button.click(); button.click(); });
          await running(page);
          assert.equal(await page.locator('video').count(), 1);
          const box = await page.locator('video').boundingBox();
          assert.ok(box.width > 100 && box.height > 100);
          fs.mkdirSync(path.join(__dirname, '../artifacts/qa/camera'), { recursive: true });
          await page.screenshot({ path: path.join(__dirname, `../artifacts/qa/camera/${width}.png`), fullPage: true });
          assert.ok(box.x >= 0 && box.x + box.width <= width + 1, JSON.stringify({ width, box, parents: await page.locator('video').evaluate(el => { const result = []; for (let node = el; node; node = node.parentElement) result.push({ tag: node.tagName, cls: node.className, width: getComputedStyle(node).width }); return result; }) }));
          await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
          await page.getByRole('button', { name: 'Start camera', exact: true }).waitFor();
          await stopped(page);
        }
        assert.equal(await page.evaluate(() => window.cameraCalls), 3);
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    for (const failure of ['NotAllowedError', 'NotFoundError', 'NotReadableError']) {
      await t.test(`${failure} preserves the page and allows retry`, async () => {
        const { page, errors } = await open();
        try {
          await page.evaluate(value => { window.cameraFailure = value; }, failure);
          await page.getByRole('button', { name: 'Start camera', exact: true }).click();
          await page.getByRole('alert').filter({ hasText: failure }).waitFor();
          await page.evaluate(() => { window.cameraFailure = null; });
          await page.getByRole('button', { name: 'Start camera', exact: true }).click();
          await running(page);
          await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
          await stopped(page);
          assert.deepEqual(errors, []);
        } finally { await page.close(); }
      });
    }
    for (const pending of [false, true]) {
      await t.test(`navigation releases camera (pending permission: ${pending})`, async () => {
        const { page, errors } = await open();
        try {
          if (pending) await page.evaluate(() => { window.delayCamera = true; });
          await page.getByRole('button', { name: 'Start camera', exact: true }).click();
          if (pending) await page.waitForFunction(() => !!window.releaseCamera);
          else await running(page);
          await page.getByRole('link', { name: 'Assets', exact: true }).click();
          if (pending) await page.evaluate(() => { window.releaseCamera(); });
          await stopped(page);
          assert.deepEqual(errors, []);
          await page.getByRole('link', { name: 'QR Codes', exact: true }).click();
          await page.evaluate(() => { window.delayCamera = false; });
          await page.getByRole('button', { name: 'Start camera', exact: true }).click();
          await running(page);
          await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
          await stopped(page);
        } finally { await page.close(); }
      });
    }
    await t.test('stop during pending permission releases the eventual stream', async () => {
      const { page, errors } = await open();
      try {
        await page.evaluate(() => { window.delayCamera = true; });
        await page.getByRole('button', { name: 'Start camera', exact: true }).click();
        await page.waitForFunction(() => !!window.releaseCamera);
        await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
        await page.evaluate(() => { window.releaseCamera(); });
        await stopped(page);
        await page.getByRole('button', { name: 'Start camera', exact: true }).waitFor();
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    await t.test('unsupported media API gives an actionable error without crashing', async () => {
      const { page, errors } = await open();
      try {
        await page.evaluate(() => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined }); });
        await page.getByRole('button', { name: 'Start camera', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'HTTPS' }).waitFor();
        await page.getByRole('button', { name: 'Start camera', exact: true }).waitFor();
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    await t.test('real decoder reads a synthetic QR stream, stops, and retrieves once', async () => {
      const { page, errors } = await open();
      try {
        const code = 'camera-regression-token';
        const qrData = await require(path.join(root, 'node_modules/qrcode')).toDataURL(code);
        const record = { _id: 'qr-test', asset: { _id: 'asset-test', assetName: 'Camera test asset', status: 'Available' }, token: code, qrValue: code, scanCount: 1, generatedAt: new Date().toISOString() };
        let scans = 0;
        await page.route('**/api/qr/scan', route => {
          scans++;
          assert.equal(route.request().postDataJSON().code, code);
          return route.fulfill({ json: { success: true, data: record } });
        });
        await page.evaluate(value => { window.qrData = value; }, qrData);
        await page.getByRole('button', { name: 'Start camera', exact: true }).click();
        await page.getByRole('heading', { name: 'Camera test asset' }).waitFor();
        await stopped(page);
        await page.getByRole('button', { name: 'Start camera', exact: true }).waitFor();
        assert.equal(scans, 1);
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    await t.test('render failure is contained and retry restores the QR route', async () => {
      const { page } = await open();
      try {
        await page.route('**/api/qr', route => route.fulfill({ json: { success: true, data: [{ asset: null }] } }));
        await page.reload();
        await page.getByRole('alert').filter({ hasText: 'could not be displayed' }).waitFor();
        assert.ok(await page.getByRole('link', { name: 'Assets', exact: true }).isVisible());
        await page.unroute('**/api/qr');
        await page.getByRole('button', { name: 'Try again' }).click();
        await page.getByRole('button', { name: 'Start camera', exact: true }).waitFor();
      } finally { await page.close(); }
    });
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
});
