# Go-Live Audit: Smart IT Asset Management

**Assessment: NOT READY FOR PRODUCTION.**

**Latest implementation pass: September 27, 2026.** Steps 1-7 have local code fixes; the Step 8 four-suite audit now passes **190/190 checks**. Production sign-off still requires the chosen host/domain, secret rotation, three historical employee mappings, real-browser/device checks and operational acceptance. The September 24 tables below are the original baseline, not current failure counts.

Audit date: September 24, 2026. Tested the current working-tree source, including the sidebar and maintenance fixes. The 47 audited source/configuration files match the isolated test copy; see the source manifest. Application code was not changed during this audit.

## Results and Scope

| Suite | Checks | Passed | Failed |
| --- | ---: | ---: | ---: |
| Browser workflows, page refresh, accessibility and viewport checks | 111 | 72 | 39 |
| Additional buttons, keyboard, validation and camera checks | 28 | 18 | 10 |
| API workflows and authorization | 40 | 12 | 28 |
| Concurrency, validation and deployment edge cases | 11 | 5 | 6 |
| Existing controller regression tests | 17 | 17 | 0 |
| **Total** | **207** | **124** | **83** |

Failures overlap: 83 failing checks do not mean 83 separate defects. This is a selected regression and release-risk audit, not a claim that every possible input, device or failure mode was tested.

- Production build and TypeScript compilation: **PASS** after `npm ci` from the unchanged lockfiles in an isolated copy.
- Lint: **FAIL**, missing `eslint-config-next` referenced by a leftover Next.js configuration.
- Browser: installed Google Chrome, driven by Playwright, against the production bundle and real Express/MongoDB APIs.
- Viewports: 1440px desktop, 1024px laptop/tablet landscape, 768px tablet portrait, and 390px mobile.
- Accessibility: automated axe WCAG A/AA scans plus focused keyboard/modal checks. This is not a full manual accessibility certification.
- Data: generated accounts and records in disposable database `smart_it_qa_1790242873282`. No real user records were used.
- The production bundle was served by a QA preview proxy. That configuration is not an implemented production deployment.
- The existing dependency installation initially stalled build/startup. Clean lockfile installation worked. Those setup failures were excluded from application test totals.

## Module Coverage

| Module | Verified working | Problems found |
| --- | --- | --- |
| Login/session | Required-field checks, invalid-password error, valid login, logout, unauthenticated route redirect | Missing show-password control; invalid token leaves user inside app; backend access controls incomplete |
| Dashboard | Loads and refreshes; navigation works | API failure appears as zero/empty data; contrast issues |
| Sidebar | Every visible navigation link; collapse/expand, keyboard activation, remembered state | Hidden admin links do not enforce backend or direct-route authorization |
| Assets | Create, prefilled edit, save, search, status filter, cancel, delete and cancel-delete | Serial number absent; lifecycle inconsistencies; unauthorized mutation; some validation errors return 500 |
| Allocations | Create, sequential duplicate rejection, return, returned-record deletion, active-asset deletion guard | Concurrent double booking; wrong assignee collection; stale dropdown after delete; maintenance overwritten on return/delete |
| Maintenance | Repair creation/edit/completion, completed filter, deletion; completion releases eligible assets and respects other open work | Most offered types rejected; Cancelled rejected; starting/reopening work does not reserve asset; orphan references allowed |
| Employees | Registration, list, search, Active/Inactive filtering; API update/delete and duplicate checks | Cannot allocate to these employees; no UI edit/delete; role-route mismatch; invalid email accepted through API |
| Users | Create IT/Admin account, list, duplicate-email feedback, non-admin provisioning redirect | Public/admin escalation; no edit/revoke/delete controls; success confirmation immediately cleared |
| Licenses | Create with valid key, edit supported name field, delete | Type/usage/cost/notes discarded; Expiring Soon rejected; over-assignment accepted; form/backend validation mismatch |
| QR codes | Automatic asset QR identity, rendered image, View, PNG download, manual lookup, bad-token error, status update, regeneration/old-token invalidation | Camera crashes app; status endpoint bypasses allocation/maintenance guards; unrestricted API |
| Profile | Displays current name/email/role; refresh works | Failed fetch silently retains cached details |
| Shared controls | Cancel and close buttons on allocation/license/maintenance modals | No keyboard focus containment; maintenance Escape does not close; missing accessible names; low contrast |

## Release Blockers

### P0-01: Unauthenticated access and administrator escalation

**Confirmed by live requests.** Anonymous callers received 201 creating an Admin, 201 creating an asset, 200 editing an asset, and 200 deleting it. Anonymous listing succeeded for allocations, employees, licenses, maintenance, QR records and users. An IT Staff token could also create an Admin.

`GET /api/assets` and `/api/auth/me` are protected, but most other routes are not. Hiding buttons or links in React is not authorization.

**Change:** apply authentication to all private API routes and explicit server-side role checks to privileged actions. Make account provisioning admin-only; use a controlled first-admin setup. Define intentionally public QR endpoints separately and minimize their disclosed data. Add negative authorization tests for every method, not just list routes.

**Source:** `routes/authRoutes.js:24`, `routes/assetRoutes.js:27`, `routes/allocationRoutes.js:25`, `routes/employeeRoutes.js:13`, `routes/licenseRoutes.js:13`, `routes/maintenanceRoutes.js:13`, `routes/qrCodeRoutes.js:14`.

**Evidence:** [API results](artifacts/qa/1790242873282/api-results.json), Authorization and Authentication cases.

### P1-02: Concurrent allocations double-book a device

**Confirmed:** eight simultaneous allocation requests for one Available device created **six active allocations**. Two returned 409; six returned 201.

The existing check-then-create sequence is not atomic. The successful sequential duplicate test does not cover concurrent requests.

**Change:** atomically claim an Available asset, enforce a database uniqueness constraint for active allocations, and keep asset/allocation writes consistent through an appropriate transaction or rollback design. Clean up duplicates before introducing the constraint.

**Source:** `controllers/allocationController.js:39`, `controllers/allocationController.js:48`, `controllers/allocationController.js:63`, `models/Allocation.js`.

**Evidence:** [concurrency result](artifacts/qa/1790242873282/edge-results.json).

### P1-03: Asset status is inconsistent across workflows

**Confirmed:** creating Scheduled or In Progress maintenance leaves a previously Available device Available. Reopening a completed job also leaves it Available. Returning or deleting an active allocation overwrites Maintenance with Available. The QR status endpoint changes devices to Available despite open maintenance or an active allocation.

The recent completion fix passes its targeted tests. The remaining defects are in other lifecycle paths, which still update asset status independently.

**Change:** use one backend status policy for maintenance creation/update/completion, allocation/return/deletion, asset edits and QR edits. Validate actual open work and active assignments before releasing a device; preserve retirement. Apply the policy consistently and handle concurrent changes.

**Source:** `controllers/maintenanceController.js:54`, `controllers/maintenanceController.js:111`, `controllers/allocationController.js:138`, `controllers/allocationController.js:162`, `controllers/qrCodeController.js:221`.

**Evidence:** API Maintenance/QR cases, browser "starting maintenance updates the Assets page", and edge lifecycle cases.

### P1-04: Maintenance options offered by the UI cannot be saved

**Confirmed in browser and API:** Upgrade, Inspection, Replacement and Cleaning return HTTP 400. Cancelled also returns 400. Repair works.

The frontend types are Repair/Upgrade/Inspection/Replacement/Cleaning, while the model accepts Preventive/Corrective/Repair. The UI offers Cancelled, while the model only accepts Scheduled/In Progress/Completed.

**Change:** agree on supported types/statuses and align the form, TypeScript definitions, schema, validation and transition behavior. Specify what cancellation does to asset availability.

**Source:** `frontend/src/pages/MaintainencePage.tsx:7`, `frontend/src/lib/api.ts:87`, `models/Maintenance.js:15`, `models/Maintenance.js:47`.

### P1-05: License form reports success while discarding entered data

**Confirmed:** creating a license with Subscription, 3 used seats, cost 99 and notes succeeds, but these fields are not returned/persisted. After reload, the row has no type, displays `/10` instead of `3/10`, and no cost. Expiring Soon returns 400. Assigning 11 seats on a 10-seat license is accepted.

The frontend sends `seatsUsed`; the backend uses `assignedSeats`. `licenseType`, `cost` and `notes` are absent from the backend whitelist/schema. The UI status list differs from the model.

**Change:** align the license contract end to end, support or remove each offered field, migrate any existing usage data as needed, and validate assigned seats against purchased seats. Align status choices and required license-key validation.

**Source:** `frontend/src/pages/LicensePage.tsx:18`, `frontend/src/lib/api.ts:71`, `controllers/licenseController.js:5`, `models/License.js:39`, `models/License.js:47`.

### P1-06: Registered company employees cannot receive allocations

**Confirmed:** a company employee created through the UI appears in Personnel Directory but not in the allocation dropdown. Sending that Employee ID to the allocation API returns "User not found".

Allocation options come from system Users, and the allocation schema references User rather than Employee. This contradicts Personnel Directory's promise that those employees are eligible for asset allocations.

**Change:** decide whether assets belong to company employees or login accounts. For the displayed company-employee workflow, query Employees, reference Employee in Allocation, update population/rendering, and provide a migration for existing assignments. Do not force every employee to become an IT system user.

**Source:** `frontend/src/pages/AllocationsPage.tsx:44`, `controllers/allocationController.js:43`, `models/Allocation.js:9`.

### P1-07: Start camera crashes the entire rendered application

**Confirmed twice:** clicking Start camera causes `Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.` The app becomes blank. A follow-up browser test successfully opened a synthetic video stream independently, ruling out lack of a test camera as the cause.

**Likely cause from source inspection:** React and Html5Qrcode both modify the children of `#qr-reader`. The scanner is constructed before React removes its placeholder. Cleanup can additionally throw "Cannot stop, scanner is not running or paused."

**Change:** give the scanner an empty, stable DOM container owned only by the scanner library; render React's placeholder outside it. Coordinate startup/cleanup with component lifecycle, handle synchronous and asynchronous stop errors, and prevent overlapping starts. Add an error boundary so a module crash does not blank the whole app.

**Source:** `frontend/src/pages/QRCodePage.tsx:75`, `frontend/src/pages/QRCodePage.tsx:168`, `frontend/src/pages/QRCodePage.tsx:324`.

**Evidence:** [blank-page screenshot](artifacts/qa/1790242873282/screenshots/failure-52.png), [camera errors](artifacts/qa/1790242873282/camera-errors.json), [control results](artifacts/qa/1790242873282/control-results.json).

### P1-08: Maintenance history can point to nonexistent assets

**Confirmed:** deleting an asset with maintenance returns 200 and leaves a maintenance record whose populated asset is null. Creating maintenance with a well-formed but nonexistent asset ID returns 201.

**Change:** validate referenced assets exist. Define a retention rule: prevent deletion while referenced, soft-delete assets while retaining history, or implement a deliberate cascade. Do not leave dangling references.

**Source:** `controllers/maintenanceController.js:48`, `controllers/maintenanceController.js:54`, `controllers/assetController.js:147`, `controllers/assetController.js:160`.

## Other Required Corrections

| Priority | Issue and reproduction | Recommended correction | Source |
| --- | --- | --- | --- |
| P1 | User module only creates/lists accounts; no disable/revoke/edit/delete controls or corresponding account-management routes | Add controlled account deactivation and role management; enforce disabled status during authentication; define token revocation behavior | `frontend/src/pages/CreateUserPage.tsx:320`, `routes/authRoutes.js` |
| P2 | Invalid token receives API 401 but remains on `/assets` | Handle 401 centrally, clear session and redirect to login; preserve intended destination where appropriate | `frontend/src/components/AuthGuard.tsx:4`, `frontend/src/lib/api.ts:22` |
| P2 | IT Staff can navigate directly to `/employees`, although the sidebar hides it | Define and consistently enforce page/API permissions | `frontend/src/pages/EmployeePage.tsx:15`, `frontend/src/components/Sidebar.tsx` |
| P2 | Employee directory has no edit/delete controls | Implement the expected management actions using the existing API, with validation and permissions | `frontend/src/pages/EmployeePage.tsx` |
| P2 | Asset serial number is absent from add/edit/list/schema; API silently drops it | Add the agreed serial-number field throughout the model, API and UI; define uniqueness rules | `models/Asset.js`, `frontend/src/pages/AddAssetPage.tsx:12`, `frontend/src/pages/EditAssetPage.tsx:11` |
| P2 | After deleting an active allocation, its now-available asset is missing from the New Allocation dropdown until refresh | Refresh availability after deletion, not only allocation rows | `frontend/src/pages/AllocationsPage.tsx:91` |
| P2 | License/maintenance/employee/dashboard/profile pages suppress failed fetches and show empty or stale data | Add visible error and retry states, and distinguish unavailable data from a genuinely empty list | `LicensePage.tsx:69`, `MaintainencePage.tsx:66`, `EmployeePage.tsx:22`, `DashboardPage.tsx:20`, `ProfilePage.tsx:15` under `frontend/src/pages` |
| P2 | Tablet tables clip columns: Employees at 1024/768px; licenses and maintenance at 768px; all three at 390px | Use scrollable table wrappers and responsive widths; keep action/status columns reachable | `EmployeePage.tsx:124`, `LicensePage.tsx:179`, `MaintainencePage.tsx:200` |
| P2 | Provisioning stays two-column on mobile; Full Name input shrinks to 74px; directory content also clips on tablet | Stack sections below a suitable breakpoint and allow text/columns to shrink or wrap | `frontend/src/pages/CreateUserPage.tsx:218` |
| P2 | Automated scans find unlabeled selects/buttons and insufficient contrast on nine app pages | Associate labels with inputs, name icon buttons, and correct failing color pairs; rerun axe and manual screen-reader tests | [Accessibility details](artifacts/qa/1790242873282/accessibility.json) |
| P2 | Keyboard Tab escapes allocation/license/maintenance modals; Escape does not close maintenance | Use accessible dialog semantics, focus trapping/restoration and Escape handling | Modal sections in the three page components |
| P2 | Cost inputs in licenses and maintenance reject 12.50 because default step is 1 | Use an appropriate decimal step and validate/store currency consistently | `LicensePage.tsx:306`, `MaintainencePage.tsx:321` |
| P2 | Maintenance description and license key are required by backend but not marked/validated as required in forms | Align visible labels, HTML constraints and server validation | `MaintainencePage.tsx:325`, `LicensePage.tsx:286` |
| P2 | Blank asset name returns 500; malformed employee email is accepted by API | Return consistent 400 validation errors and enforce email format server-side | `controllers/assetController.js:39`, `models/Employee.js:15` |
| P2 | Lint cannot run after a clean install: missing `eslint-config-next` | Replace the obsolete Next configuration with a declared Vite/React/TypeScript lint setup and make CI enforce it | `frontend/eslint.config.mjs:2`, `frontend/package.json` |
| P2 | Default backend start serves an API text page, not the built React app; `/dashboard` returns 404 | Implement or document static frontend hosting, API reverse proxy and SPA fallback for the target deployment | `server.js:34`, `server.js:37`, `frontend/vite.config.ts` |
| P3 | User creation success message vanishes immediately | Do not clear success feedback in the immediate list refresh | `frontend/src/pages/CreateUserPage.tsx:83`, `frontend/src/pages/CreateUserPage.tsx:135` |
| P3 | Login lacks the requested show-password control | Add an accessible show/hide control | `frontend/src/pages/LoginPage.tsx` |

## Dependency and Deployment Review

`npm audit` reported the following against the existing lockfiles. These are package-level advisory reports, not confirmed exploitability of every advisory in this app.

| Tree | Advisory-affected packages | Reported severities | Context |
| --- | --- | --- | --- |
| Backend | brace-expansion, body-parser, express, qs | 1 high, 3 moderate | High-severity brace-expansion is a dev dependency; qs is runtime. Counts include propagated dependency findings. |
| Frontend | brace-expansion, js-yaml, nanoid, postcss, react-router, react-router-dom | 5 high, 1 moderate | Most affected packages are build/dev tooling. The reported Router advisory concerns RSC mode, which this SPA does not use; do not equate its presence with a demonstrated exploit. |

**Action:** review and update affected dependency versions, regenerate lockfiles deliberately, then rebuild and rerun regression tests. Avoid a blind forced dependency upgrade.

Evidence: [backend audit JSON](artifacts/qa/1790242873282/backend-dependencies.json), [frontend audit JSON](artifacts/qa/1790242873282/frontend-dependencies.json).

Additional source-review concerns, not deployment-environment tests:

- Authentication falls back to the public constant `dev-jwt-secret` if JWT_SECRET is missing. Production should refuse startup without an appropriate secret. Sources: `controllers/authController.js:17`, `middleware/authMiddleware.js:4`.
- CORS is unrestricted; configure allowed origins for the intended deployment. Source: `server.js:23`.
- No login rate limiter, disabled-user workflow, audit trail or operational health/readiness endpoint was found in the inspected application routes. Confirm these operational requirements before release.
- Database connection failures are logged while the server continues listening. A live HTTP process alone does not show that CRUD operations are ready. Source: `config/db.js`, `server.js:45`.

## What Passed

The normal single-user asset create/read/edit/delete path works. Allocation and return work when requests are sequential and no conflicting maintenance is present. Repair completion now updates the linked asset correctly and respects another unfinished job. Search/filter controls tested on assets and employees work. Navigation and sidebar controls work. User and employee creation work for valid inputs. Supported license fields can be created/edited/deleted. QR image generation, viewing, download, manual lookup and token regeneration work. Profile displays the authenticated user. Logout clears the local session. All 17 existing controller regression tests pass.

These passes do not override the authorization, concurrency and cross-module failures above.

## Coverage Limits

- Physical camera hardware, printed-label decoding, camera denial/recovery on real devices, Safari, Firefox, Edge, iOS and Android were not verified. Camera startup already fails in the tested Chrome environment, so the physical scan workflow cannot be signed off.
- No production hosting, HTTPS/TLS, backup/restore, disaster recovery, large-dataset performance, long-running soak, penetration-test certification or real assistive-technology session was tested.
- The account model currently supports Admin and IT Staff. Company employees are separate directory records, not a third login role; that mismatch is documented above.
- Asset Edit was exercised in the workflow tests; the viewport matrix covers the Add form, not every possible populated Edit state. Axe scans cover the listed page states, not every open modal state.
- Some checks intentionally assert expected missing capabilities (serial number, employee/account management, show password). These are identified as feature gaps rather than runtime exceptions.
- Error-handling checks deliberately returned HTTP 500; those console messages are expected test stimuli. The QR `removeChild` and scanner-stop errors are unexpected application failures.
- Initial setup attempts and an aborted pre-production browser attempt are in earlier artifact folders. Only run `1790242873282` is authoritative for the totals in this report.

## Fix and Retest Order

1. **Completed September 25, 2026:** Close anonymous API access and privilege escalation; add server-side role enforcement and account revocation. See the retest below.
2. **Completed locally September 26, 2026:** Make allocation atomic and unify asset-status transitions across every module. The replica-set conversion and final real-server verification are recorded below.
3. **Implemented and retested September 26, 2026; three historical employee mappings await an owner decision:** Align maintenance/license/employee contracts and protect referential integrity. New allocations use Employees; unmapped history is preserved.
4. **Implemented and retested September 26, 2026:** Fix the QR camera DOM/lifecycle crash and add QR-route error recovery. Physical-camera and cross-browser checks remain in step 8.
5. **Implemented and retested September 26, 2026:** Correct session handling, error feedback, missing management controls and serial-number support. See the Step 5 retest and serial policy below.
6. **Implemented September 27, 2026:** Responsive tables/forms, accessible control labels and contrast, modal focus containment/restoration, and existing form-validation regressions.
7. **Implemented locally September 27, 2026:** Active Vite lint configuration, compatible dependency patches, same-origin production serving and server hardening. Actual host configuration and CI/container execution remain acceptance gates.
8. **Automated audit and combined regressions passed September 27, 2026; external acceptance pending:** Supported real browsers/devices, physical QR scanning and operational deployment/recovery procedures still need sign-off.

### Steps 6-8 and Navigation: September 27, 2026

| Final audit suite | Passed | Failed |
| --- | ---: | ---: |
| Browser workflows, accessibility and responsive layouts | 111 | 0 |
| Additional navigation, controls and keyboard checks | 28 | 0 |
| API workflows and authorization | 40 | 0 |
| Concurrency, validation and deployment edge cases | 11 | 0 |
| **Total** | **190** | **0** |

Final audit [summary](artifacts/qa/1790513350710/summary.json) and [source manifest](artifacts/qa/1790513350710/source-manifest.json): all 59 audited files match the tested copy. All 11 broad-audit axe page scans have zero detected violations. The disposable database and both audit servers were removed/stopped. This remains selected automated coverage, not proof that every possible browser, input or failure mode works.

The separate final combined regression run passes **258 tests including parent tests**, with zero failures, skips or cancellations (328.6 seconds). It covers access control, lifecycle/concurrency/rollback, module contracts, QR camera behavior, sessions/management and production release readiness. Release checks cover 12 routes at 1440/1024/768/390px, plus 15 axe page/modal scans with zero detected violations. Both build and zero-warning lint pass; 48 JavaScript files pass syntax checks and the scoped source diff passes whitespace checks. All disposable MongoDB and test processes have exited. The existing local MongoDB service was left untouched. Frontend-only preview is at `http://127.0.0.1:3000/`; the real backend remains stopped, so this preview does not provide a working login until that backend is started.

- **Responsive and accessible UI:** Tables scroll within their region instead of clipping the page; forms collapse to one column on narrow screens. Labels and icon-button names are associated with controls. Text contrast and focus indicators were corrected, including the populated Cancelled maintenance badge. Allocation, license and maintenance dialogs support contained keyboard focus, Escape and restoration to the invoking button.
- **Navigation:** Main modules are Dashboard, Assets, Allocations, Maintenance, Licenses, QR Codes, Employees and Users (last two Admin-only). Profile now belongs to the separate account footer above identity and Sign Out, including collapsed mode.
- **Tooling and dependencies:** Removed the obsolete Next lint configuration from the active Vite frontend. Fresh isolated lockfile installs, TypeScript/Vite build and lint with zero warnings pass. Both npm installs report zero audit vulnerabilities. This is a point-in-time dependency check, not security certification.
- **Server and deployment:** Express serves the current React production build and deep links, provides readiness health checks and explicit API 404s, limits request size/login attempts, restricts CORS and sets security headers. Startup waits for MongoDB and fails on missing/unreachable configuration. Added a non-root Docker definition, CI workflow, environment template and deployment checklist; Docker and hosted CI have not been executed.
- **Secrets:** The previously tracked `.env` is staged for removal from Git while the local file is preserved. Earlier commits still contain its history. Credential rotation/history remediation are not completed by ignoring or untracking the file.
- **Release gates:** Confirm the actual deployment domain/proxy, TLS and network controls; rotate exposed secrets; resolve the three historical allocation mappings; perform physical printed-QR and supported-browser/screen-reader checks; validate backup restore, failover, load, monitoring and rollback on the target environment. No real inventory was modified by this retest.
- **Evidence:** [stable-build regression results](artifacts/qa/final-regression-stable.txt), [build](artifacts/qa/release-build.txt), [lint](artifacts/qa/release-lint.txt), [release accessibility](artifacts/qa/release/accessibility.json), [deployment checklist](docs/DEPLOYMENT.md), [reproduction](tests/qa/README.md).
- **Retest setup:** An intermediate rerun rebuilt `frontend/dist` while browsers were consuming it. This caused one document failure followed by dependent layout failures, plus two QR timeouts. Those results are retained in `1790513041504` and `final-regression.txt`; a fresh fixture set and unchanged build are used for the final retest. They must not be treated as passing runs.

### Step 5 Retest: September 26, 2026

- **Sessions:** Private JSON and QR-image 401 responses clear the current session and redirect to sign-in. Successful login restores the intended local route. Late responses for an older token cannot clear a newer login. Cross-tab logout updates protected content. A 403, HTTP 500 or network failure does not log the user out. Login now has an accessible show/hide password control; invalid credentials remain visible.
- **Permissions and management:** Employee directory and account provisioning routes require Admin in the UI as well as the existing server checks. Personnel Directory now has prefilled edit, cancel, save and delete controls. Allocation-history/deactivation guards remain enforced and their errors are displayed. Account editing supports name, email and role, rejects self edits and unsupported fields, and atomically revokes existing sessions. Account deactivation remains the intentional alternative to hard deletion, preserving history.
- **Feedback:** Dashboard, profile, employee, license, maintenance and account-directory fetch failures show visible retry states instead of silently presenting empty/current data. Profile no longer presents cached details as a successful fetch. License/maintenance deletion errors remain visible without removing the row. Provisioning success messages survive the immediate directory refresh. Allocation availability refresh was already corrected in Step 2 and remains covered by regression tests.
- **Serial numbers:** Add, prefilled edit, list and search now include optional `serialNumber`. Values are trimmed, limited to 120 characters, and persisted. Non-empty serials currently use global, case-insensitive database uniqueness; blanks remain optional for legacy inventory. Concurrent duplicates return 409. Index creation failure blocks serial writes safely. This default uniqueness policy should be confirmed against manufacturer conventions before deployment; see [serial-number policy](docs/ASSET_SERIAL_NUMBERS.md). No existing business data was migrated.
- **Verification:** The combined security, status, lifecycle, contracts, camera and Step 5 suites report **189 passing tests including parent tests**, zero failures and zero skips. The 26 new Step 5 scenarios cover real API and Chrome workflows, including server/network failures, duplicate serial writes, account authorization/revocation, employee history conflicts, save-error retention, cancellation, and deletion feedback. TypeScript/Vite production build passes in the isolated lockfile installation. JavaScript syntax checks and `git diff --check` pass. New editor screenshot inspected.
- **Evidence:** [combined results](artifacts/qa/step5-regression.txt), [regression suite](tests/sessionManagement.test.cjs), [employee editor](artifacts/qa/step5/employee-editor.png), [permissions and sessions](docs/ACCESS_CONTROL.md).
- **Limits:** Tests use disposable replica sets and temporary browser/API fixtures, not real inventory. The frontend preview remains available on port 3000; the real backend is stopped and was not restarted by this step. This is not the full original audit, production deployment verification, or cross-browser/accessibility certification. Steps 6-8 and the three historical allocation mappings from Step 3 remain outstanding; the application is still not ready for production.

### Step 4 Retest: September 26, 2026

- **Root cause:** React rendered its camera-off placeholder inside the same element whose children `html5-qrcode` replaces. Removing that placeholder after camera startup caused the `removeChild` crash. The old cleanup also raced with asynchronous startup and could call `stop()` before the scanner was ready.
- **Fix:** `frontend/src/components/QRScanner.tsx` owns the scanner lifecycle and gives the library an imperative child separate from React's overlay. Duplicate starts and repeated decode callbacks are guarded. Cleanup waits for startup/playback, releases tracks, and removes its host, including when permission resolves after navigation. Browser permission prompts cannot be programmatically cancelled; a pending stop completes when the browser resolves that request.
- **Recovery:** `QRCodeBoundary.tsx` contains unexpected QR-route render failures, retaining navigation and a retry button. Camera permission/device errors remain visible within the page. This boundary does not claim to catch arbitrary asynchronous errors elsewhere in the app.
- **Browser coverage:** `tests/qrCamera.test.cjs` exercises ten scenarios using the production React build, real `html5-qrcode`, Chrome synthetic media and isolated API fixtures. Repeated start/stop and duplicate clicks; 1440/1024/768px camera layouts; denied/missing/busy cameras and retry; navigation during pending/running sessions; pending stop; unavailable media API; actual decoding of a generated QR stream with exactly one lookup; render failure and retry all pass. Node reports **11 passing tests including the parent test**, with zero failures or skips.
- **Evidence:** [camera test results](artifacts/qa/camera-retest.txt), [combined regression results](artifacts/qa/step4-regression.txt), [desktop screenshot](artifacts/qa/camera/1440.png), [tablet screenshot](artifacts/qa/camera/768.png).
- **Combined regression:** The camera, access-control, asset-lifecycle, module-contract and asset-status suites report **162 passing tests including parent tests**, zero failures and zero skips against the final build. Database suites use disposable replica sets, not the development database.
- **Build:** TypeScript and the Vite production build pass in a clean isolated install using the repository lockfiles. The workspace dependency installation stalled and was stopped by the 70-second timeout; it is not reported as a successful workspace build.
- **Limits:** No real application records were changed by camera tests. Physical cameras/printed labels, Safari/Firefox/Edge, phone layouts, and the full original audit remain unverified. Step 4 does not resolve the outstanding session, accessibility, dependency or deployment findings.

### Step 1 Retest: September 25, 2026

The original findings and 207-check totals above remain the September 24 baseline, not current retest totals. The application is still not ready for production; steps 2-8 remain outstanding.

- All private routers now require authentication. Account creation/listing/access changes and employee management require Admin. Operational APIs allow Admin and IT Staff. All 36 anonymous endpoint/method checks returned 401; staff requests to privileged endpoints returned 403.
- Disabled accounts cannot log in or use existing tokens. Atomic token-version increments revoke sessions without deleting history. Enable does not revive old tokens. Roles are read from the database on each request. Users now has Disable/Enable and Revoke sessions controls.
- Password hashes are excluded from normal User queries and allocation responses. Allocation selection uses a limited active-user identity endpoint, not the privileged account directory. The separate Employee allocation-contract fix remains pending.
- QR preview/download now uses authenticated image requests. QR resolution is private, not an anonymous asset-data endpoint.
- Missing/short JWT secrets fail startup. Legacy tokens require a fresh login. A local-only first-admin script refuses to run when accounts already exist.
- **Verification:** Node reports 87 passing tests (69 access-control subtests, their parent test, and 17 existing status regressions), zero failures. Chrome exercised login, staff allocation options, private QR rendering/download, and admin disable/enable/revoke controls. The production TypeScript/Vite build passed in the isolated lockfile installation. `git diff --check` passed. Disposable test databases were removed and temporary HTTP/browser processes closed.
- **Limits:** This is a targeted step-1 retest, not a repeat of the full audit or production security certification. Existing UI session-expiry redirects, account editing, camera startup, lint, dependencies and deployment hardening remain in their scheduled steps. The existing development servers were not restarted or changed.

Evidence: [test output](artifacts/qa/access-control-retest.txt), [regression test](tests/accessControl.test.cjs), [permissions and setup](docs/ACCESS_CONTROL.md).

### Step 2 Retest: September 25, 2026

**Initial retest: implementation verified; local setup was pending.** The September 25 topology check found standalone MongoDB. The approved conversion and final verification below resolve that local prerequisite; other deployment environments still require transaction support.

- Asset creation/deletion, allocation/return/deletion, maintenance creation/edit/completion/deletion and direct/QR status edits use a shared transaction service. Writes to a shared asset revision serialize competing lifecycle operations through MongoDB transaction conflict/retry handling, not an in-process mutex.
- A partial unique index enforces one active allocation per device. Twelve simultaneous allocation requests produced exactly one 201 and eleven 409 responses. Direct duplicate insertion also failed at the database constraint. Existing duplicates cause preflight/index creation to fail safely; nothing is automatically deleted.
- Status priority is Retired, open maintenance/manual hold, active allocation, then Available. Starting/reopening work reserves the device; return/delete cannot clear open maintenance; completion restores the correct assignment or availability. Moving a maintenance record reconciles both assets atomically.
- Direct and QR edits cannot bypass open work or assignments, fabricate Allocated status, or retire an actively assigned device. The Add Asset form no longer offers Allocated. Manual maintenance reservations are preserved until explicitly released or replaced by a work record.
- Referenced asset deletion is blocked, and missing maintenance asset references are rejected. These integrity guards overlap part of step 3; the maintenance/license enum contracts and employee-assignment migration remain outstanding.
- Allocation deletion now reloads both records and available-asset choices. Chrome confirmed the dropdown refresh and Assets-page Maintenance-to-Available transition after completing a repair.
- **Verification:** 121 Node tests passed, zero failures (including parent tests): access-control regression, 23 direct status-policy cases, transactional HTTP workflows, concurrent lifecycle operations, duplicate returns, history deletion, database uniqueness, and injected-failure rollback. Both allocation/asset and maintenance/asset writes rolled back together on injected failure. Standalone MongoDB rejection was verified without persisting the attempted asset. Production TypeScript/Vite build and `git diff --check` passed.
- The old 17 controller-mock tests were replaced by policy tests and real transactional controller coverage. Retirement is preserved, but legacy Allocated labels without an actual allocation are now reconciled rather than blindly retained. Missing referenced assets now produce 404 instead of permitting orphan maintenance updates.
- All test MongoDB processes, temporary directories, HTTP listeners and Chrome instances were cleaned up. The full original audit, physical-device testing, and production failover/load/backup recovery have not been rerun.

Evidence: [test output](artifacts/qa/lifecycle-retest.txt), [transactional regression](tests/assetLifecycle.test.cjs), [policy tests](tests/assetStatus.test.js), [deployment and status rules](docs/ASSET_LIFECYCLE.md). Run the documented preflight and index setup after a backed-up replica-set configuration; do not replace existing data with the empty development example.

### Local Conversion Verified: September 26, 2026

- With user approval, the existing MongoDB data directory and port were preserved while configuring single-member replica set `smartit-rs`, member `localhost:27017`. The application URI now specifies `replicaSet=smartit-rs`.
- Backup: `/Users/MahmoodMohammed/Documents/Smart-IT-Backups/2026-09-25T17-31-28-078Z`. This private directory contains a compressed MongoDB archive, original MongoDB/app configuration, checksum manifest, and restore-verification log. Do not commit or publish the backup: it includes account data and configuration secrets.
- The archive was restored into a separate disposable instance. All 21 application documents across 7 collections matched the source counts and SHA-256 fingerprints. Those fingerprints also matched after conversion and final transaction verification.
- The allocation preflight found no duplicate active allocations, and the unique index was created successfully without modifying records.
- On the converted server, a separate disposable database passed transaction commit/rollback, eight-way allocation concurrency (one success), maintenance, return and completion checks. That test database was removed afterward. No existing business records were used as test fixtures.
- MongoDB is PRIMARY. The backend was restarted and confirmed connected; the existing frontend at `http://localhost:3000` returns 200 and its anonymous `/api/assets` proxy request returns the expected 401.
- Homebrew's service wrapper failed to resolve the installed plist. The existing macOS LaunchAgent was loaded directly; its service definition, executable and data directory were retained. See the lifecycle document for the working service commands.
- The first restore command selected the wrong namespace and restored zero records; validation caught it. The command was corrected and the full restore comparison passed before replica-set configuration. Final verification was resumed after an approval-service usage-limit interruption.
- Step 2 is now verified on the local setup. A single-node deployment is not a production redundancy/failover solution. Step 3 and the remaining release work are still outstanding; this does not change the overall go-live assessment.

### Step 3 Retest: September 26, 2026

- Maintenance now supports Preventive, Corrective, Repair, Upgrade, Inspection, Replacement and Cleaning, plus Scheduled/In Progress/Completed/Cancelled. Cancellation uses the shared lifecycle policy; open jobs, active assignments and retirement are respected. Required description and decimal-cost controls match backend validation.
- License fields now persist end to end: type, assigned seats, cost and notes are no longer dropped. The UI uses the existing `assignedSeats` field. All four offered types and Active/Expired/Expiring Soon/Suspended statuses round-trip. Required keys, whole nonnegative seat counts, finite costs and capacity limits are enforced. Transactional merged-document updates prevent concurrent capacity/usage edits from over-assigning seats.
- Existing license usage is retained. Historically absent type/cost values display as Not recorded instead of invented defaults. Previously discarded values cannot be recovered by this change.
- New allocations require an active Employee ID, not a login User ID. Admin and IT Staff use a minimal authenticated employee picker; full directory management remains admin-only. Employee deletion with history and deactivation with active assignments are rejected. Transactional employee writes guard allocation/deletion/deactivation races.
- Historical User allocations remain visible with a legacy label and remain returnable. A dry-run-by-default, transactional, idempotent migration maps unique normalized emails or explicit allocation-to-employee IDs while retaining the original user reference.
- **Existing data decision pending:** the real database dry run reported three unmapped historical allocations and no unique email matches. No mappings were applied and no owners were guessed. Explicit employee mappings are still needed to finish converting those historical references; the new employee workflow is operational without them.
- Asset/maintenance reference guards from Step 2 remain in place. QR creation, regeneration and lazy backfill now share the asset lock, preventing orphan QR records during asset deletion.
- **Verification:** 151 Node tests passed, zero failures, including the security/status/lifecycle regressions, 29 new contract/browser cases and parent tests. Chrome verified employee registration followed by allocation, license save/reload/edit with decimal cost, and Upgrade maintenance followed by cancellation. TypeScript/Vite production build, 32 JavaScript syntax checks and `git diff --check` passed. Testing used disposable replica sets; real business records were only read for migration planning.
- Backend restarted with the verified source. The existing frontend remains at `http://localhost:3000`. Camera startup, session/error UX, missing broader management features, accessibility/layout, dependencies and production deployment work remain in their scheduled steps. This is not a full rerun of the original 207-check audit.

Evidence: [combined test output](artifacts/qa/contracts-retest.txt), [contract tests](tests/moduleContracts.test.cjs), [contracts and migration procedure](docs/MODULE_CONTRACTS.md).

## Evidence and Reproduction

- [Summary counts and build/lint outcome](artifacts/qa/1790242873282/summary.json)
- [Source snapshot hashes](artifacts/qa/1790242873282/source-manifest.json)
- [Browser results, including screenshot paths](artifacts/qa/1790242873282/frontend-results.json)
- [Additional control results](artifacts/qa/1790242873282/control-results.json)
- [API results](artifacts/qa/1790242873282/api-results.json)
- [Concurrency and edge results](artifacts/qa/1790242873282/edge-results.json)
- [Accessibility violations and selectors](artifacts/qa/1790242873282/accessibility.json)
- [Viewport measurements](artifacts/qa/1790242873282/layouts.json)
- [Browser errors](artifacts/qa/1790242873282/browser-errors.json)
- [Clipped employee table at 768px](artifacts/qa/1790242873282/screenshots/employees-768.png)
- [Narrow provisioning form at 390px](artifacts/qa/1790242873282/screenshots/users-390.png)
- [Audit runner instructions](tests/qa/README.md)

The scripts and evidence are retained for retesting. The audit did not apply application fixes or modify real saved records.
