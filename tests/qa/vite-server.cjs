const path = require('node:path');
const { realpathSync } = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = realpathSync(path.join(process.env.QA_APP_ROOT, 'frontend'));
  const { preview } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
  const server = await preview({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    preview: { port: 3301, host: '127.0.0.1', strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:5301', changeOrigin: true } } },
  });
  server.printUrls();
})().catch((error) => { console.error(error); process.exitCode = 1; });
