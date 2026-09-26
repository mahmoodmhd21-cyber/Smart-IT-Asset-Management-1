const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../..');
const target = '/tmp/smart-it-qa-app';
fs.mkdirSync(path.join(target, 'frontend'), { recursive: true });
const backendFiles = ['server.js', 'controllers', 'models', 'routes', 'middleware', 'config', 'scripts', 'services', 'package.json', 'package-lock.json'];
const frontendFiles = ['src', 'public', 'app', 'components', 'lib', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'postcss.config.mjs', 'eslint.config.mjs'];
for (const name of backendFiles) fs.cpSync(path.join(source, name), path.join(target, name), { recursive: true });
for (const name of frontendFiles) fs.cpSync(path.join(source, 'frontend', name), path.join(target, 'frontend', name), { recursive: true });
console.log(`Copied current source and lockfiles to ${target}; excluded .env and existing node_modules.`);
