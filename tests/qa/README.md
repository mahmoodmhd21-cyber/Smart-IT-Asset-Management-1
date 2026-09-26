# Local Release Audit

These scripts audit the current working tree using an isolated copy and disposable MongoDB database. They deliberately test failure and unauthorized-access cases. They are not intended for a shared, staging or production database.

Requirements: Node, npm, `mongod` on PATH (or `QA_MONGOD` set to its executable path), installed Google Chrome, and free ports 3301/5301. The runner launches a separate disposable MongoDB replica set on a free port; an existing local database is not required or changed.

The browser runners use temporary Playwright and axe installations. No dependency or application source files are changed by the test setup.

Run from the repository root:

```sh
node tests/qa/copy-app.cjs
npm ci --prefix /tmp/smart-it-qa-app
npm ci --prefix /tmp/smart-it-qa-app/frontend
npm run build --prefix /tmp/smart-it-qa-app/frontend
npm install --prefix /tmp/smart-it-qa-tools --no-save --package-lock=false playwright @axe-core/playwright
QA_APP_ROOT=/tmp/smart-it-qa-app node tests/qa/environment.cjs
```

Wait for "QA environment ready". Leave that terminal open. In a second terminal, run the suites sequentially:

```sh
node tests/qa/run-command.cjs 180 node tests/qa/api-audit.cjs
node tests/qa/run-command.cjs 600 node tests/qa/frontend-audit.cjs
node tests/qa/run-command.cjs 90 node tests/qa/edge-audit.cjs
node tests/qa/run-command.cjs 180 node tests/qa/control-audit.cjs
node --test tests/assetStatus.test.js
node tests/qa/summarize.cjs
```

The environment seeds the isolated first admin directly in its disposable database; public registration is now forbidden. The API suite logs in and provisions the staff account used by the browser suites. Run it first, once per freshly created QA environment. The suite results are written after each case. Individual failing assertions are recorded as FAIL but do not stop the remaining cases; inspect the JSON results rather than relying only on the process exit code. Exit failures indicate fatal setup/runner errors.

`summarize.cjs` aggregates the four dynamic suite result files and compares source hashes. Its controller/build/lint fields record this audit's observed baseline; rerun those commands and update these fields when using the script for a later release. They are not freshly executed by the summary script.

Press Enter in the environment terminal after testing. It stops the two QA servers, drops only the timestamped database created by that environment, and stops/removes its disposable MongoDB instance. Generated evidence remains in `artifacts/qa/<run-id>/`. The temporary state file at `/tmp/smart-it-qa-state.json` contains disposable test credentials; do not publish it.

Other checks:

```sh
npm run lint --prefix /tmp/smart-it-qa-app/frontend
npm audit --prefix /tmp/smart-it-qa-app --json
npm audit --prefix /tmp/smart-it-qa-app/frontend --json
```

## Access-Control Regression

After copying current source and building the frontend as above, this regression suite creates its own disposable replica set and HTTP listener, then removes both. It does not need the environment runner. Unlike the broad audit runners, assertion failures produce a nonzero exit code.

```sh
QA_APP_ROOT=/tmp/smart-it-qa-app QA_BROWSER=1 QA_PLAYWRIGHT=/tmp/smart-it-qa-tools/node_modules/playwright node --test --test-concurrency=1 tests/accessControl.test.cjs tests/assetLifecycle.test.cjs tests/moduleContracts.test.cjs tests/assetStatus.test.js
```

Omit `QA_BROWSER=1` to run only the API/controller tests. A sandbox may require permission to launch mongod, connect to loopback ports and launch Chrome. No real database credentials are read. The suite also verifies local first-admin bootstrap, rejection of missing/short JWT secrets, simultaneous lifecycle requests, and rollback after injected write failures. Transaction deployment requirements are in `docs/ASSET_LIFECYCLE.md`.

Current audit findings, fix progress and coverage limitations are in `QA_REPORT.md`. Running these audit scripts does not apply fixes.

## QR Camera Regression

After copying source, installing dependencies and building as above:

```sh
QA_APP_ROOT=/tmp/smart-it-qa-app QA_PLAYWRIGHT=/tmp/smart-it-qa-tools/node_modules/playwright node tests/qa/run-command.cjs 150 node --test tests/qrCamera.test.cjs
```

This suite starts and closes its own HTTP server and Chrome instance. It uses the actual built React app and QR decoder, synthetic video tracks and API fixtures, without connecting to MongoDB. It covers permission errors, repeated start/stop, navigation cleanup, QR decoding, error-boundary retry and desktop/tablet camera layouts. Screenshots are written to `artifacts/qa/camera/`. Physical cameras and other browsers require separate testing.

Include `tests/qrCamera.test.cjs` in the combined access-control/lifecycle/contracts command above for the complete focused regression set.

## Sessions and Management Regression

After building the isolated copy, run:

```sh
QA_APP_ROOT=/tmp/smart-it-qa-app QA_PLAYWRIGHT=/tmp/smart-it-qa-tools/node_modules/playwright node tests/qa/run-command.cjs 210 node --test tests/sessionManagement.test.cjs
```

This suite uses a disposable replica set, real API routes and Chrome. It checks session invalidation/recovery, stale responses, cross-tab logout, server/network retry states, serial-number persistence/uniqueness/concurrency, employee management/history guards, account editing/revocation, and persistent provisioning feedback. It closes its browser/server and removes the disposable database process. Include it with the earlier suites for the combined regression run.
