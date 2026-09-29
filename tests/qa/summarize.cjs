const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const state = JSON.parse(fs.readFileSync('/tmp/smart-it-qa-state.json', 'utf8'));
const root = path.resolve(__dirname, '../..');
const suites = ['api-results.json', 'frontend-results.json', 'edge-results.json', 'control-results.json'];
const summary = { runId: state.runId, node: process.version, suites: [], passed: 0, failed: 0 };
for (const file of suites) {
  const results = JSON.parse(fs.readFileSync(path.join(state.output, file), 'utf8'));
  const passed = results.filter((result) => result.status === 'PASS').length;
  const failed = results.filter((result) => result.status === 'FAIL').length;
  summary.suites.push({ file, total: results.length, passed, failed });
  summary.passed += passed;
  summary.failed += failed;
}
// Never present the original audit's hard-coded build/lint/controller results as fresh checks.
summary.separateEvidence = {
  regression: 'artifacts/qa/final-regression-stable.txt',
  build: 'artifacts/qa/release-build.txt',
  lint: 'artifacts/qa/release-lint.txt',
  note: 'These commands are not executed by this summary script; inspect their separate results.',
};

const manifest = [];
function inspect(relative) {
  const location = path.join(root, relative);
  if (fs.statSync(location).isDirectory()) {
    for (const name of fs.readdirSync(location)) inspect(path.join(relative, name));
  } else {
    const copy = path.join('/tmp/smart-it-qa-app', relative);
    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(location)).digest('hex');
    const copiedHash = crypto.createHash('sha256').update(fs.readFileSync(copy)).digest('hex');
    manifest.push({ file: relative, sha256: sourceHash, matchesTestedCopy: sourceHash === copiedHash });
  }
}
for (const name of ['server.js', 'controllers', 'models', 'routes', 'middleware', 'config', 'services', 'frontend/src', 'frontend/eslint.config.mjs', 'package.json', 'package-lock.json', 'frontend/package.json', 'frontend/package-lock.json']) inspect(name);
summary.sourceFiles = manifest.length;
summary.sourceDrift = manifest.filter((file) => !file.matchesTestedCopy);
fs.writeFileSync(path.join(state.output, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(state.output, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
