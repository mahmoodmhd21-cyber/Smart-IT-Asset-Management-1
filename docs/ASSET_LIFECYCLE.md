# Asset Lifecycle and Transaction Setup

## Status Rules

One backend service now governs asset, allocation, maintenance and QR status writes. Each operation commits its related records together in a MongoDB transaction. Competing operations write a shared asset revision, causing conflicting transactions to retry against current data. A partial unique index additionally enforces at most one `Allocated` allocation per asset, including writes outside the API.

Automated status precedence is:

1. Retired stays Retired.
2. Scheduled/In Progress maintenance or a manual maintenance hold means Maintenance.
3. An active allocation means Allocated.
4. Otherwise the asset becomes Available.

- Completing, deleting or moving maintenance reconciles affected assets. Moving a job locks both assets in a consistent order.
- Returning/deleting an assignment never bypasses open maintenance or retirement. Deleting old returned history does not clear a newer assignment.
- Available cannot be set through asset edits or QR edits while work or an allocation is open.
- Allocated requires an actual allocation. The Add Asset form no longer offers this status; create the assignment afterward.
- Retiring an actively allocated asset requires returning it first. Open work may still be completed after retirement without reactivating the device.
- A manual Maintenance status holds the device until explicitly released or replaced by a Scheduled/In Progress job. Once replaced by a work record, completing the last job releases it normally. Saving an unchanged Maintenance status on an asset with an open job does not introduce a second hold.
- Asset deletion is blocked while allocation or maintenance history references it. Retire the asset to keep history. New/moved maintenance cannot reference missing assets.

The internal `lifecycleVersion` and `maintenanceHold` fields cannot be supplied through asset-create/edit payloads. Older records receive Mongoose defaults on load. A legacy Maintenance label without an open job can be corrected by saving its completed repair or explicitly setting Available; review unexplained historical labels rather than bulk-changing them blindly. Historical Allocated labels without a real allocation are no longer preserved by automatic reconciliation.

Step 3 now aligns maintenance/license contracts and uses Employees for new allocations. Historical User assignments remain readable until explicitly mapped; see `docs/MODULE_CONTRACTS.md`. Existing assignments and duplicate records are never silently reassigned or deleted.

## MongoDB Requirement

**Transactions require a replica set or sharded cluster.** MongoDB Atlas replica sets support this; a standalone local mongod does not. Unsupported deployments return HTTP 503 before lifecycle writes. There is no non-transactional fallback. Authentication and reads can still operate, so checking the API home page alone is not a readiness test.

The approved local conversion was verified on September 26, 2026. The existing database now uses replica set `smartit-rs` on `localhost:27017`, with the same `/opt/homebrew/var/mongodb` data directory. `.env` specifies `replicaSet=smartit-rs`. All 21 existing documents across 7 collections matched the restore-verified backup before and after conversion. Transactional lifecycle checks also passed on this server in a disposable database.

The private backup is `/Users/MahmoodMohammed/Documents/Smart-IT-Backups/2026-09-25T17-31-28-078Z`. It includes the MongoDB archive, original configuration files, fingerprints and verification logs. Keep it outside version control. Restoring it over live data requires a separate, deliberate recovery procedure; do not overwrite newer records.

The installed Homebrew service wrapper currently cannot resolve its MongoDB plist. The existing macOS LaunchAgent works directly:

```sh
launchctl bootout gui/$(id -u)/homebrew.mxcl.mongodb-community@8.0
launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/homebrew.mxcl.mongodb-community@8.0.plist"
```

These are stop/start commands, not commands to run routinely while the application is in use. The existing LaunchAgent has `RunAtLoad` enabled. The backend is running from this workspace; start it with `node server.js` when it is stopped. The frontend remains available at `http://localhost:3000`.

Before deploying:

1. Back up the database and stop/drain all older application instances. Old code does not participate in the new status locking policy.
2. Confirm the deployment supports transactions. For an existing standalone database, plan a backed-up replica-set conversion; do not replace its data directory with an empty one.
3. Run `node scripts/lifecycle-preflight.js` with the intended `MONGO_URI` configured. This checks topology and lists duplicate active-allocation IDs without modifying records.
4. Resolve any duplicates deliberately, preserving the correct assignee and history. The preflight never guesses which allocation to keep.
5. Run `node scripts/lifecycle-preflight.js --apply` to create the unique active-allocation index. The API also ensures that index exists before lifecycle writes and refuses writes if creation fails. Do not drop the index while the app is running.
6. Start the updated application instances and rerun the workflow checks. Use the same replica-set URI for every instance.

For **new, empty local development data only**, a separate instance can be started without changing a running database:

```sh
mkdir -p /tmp/smart-it-dev-rs
mongod --dbpath /tmp/smart-it-dev-rs --port 27018 --bind_ip 127.0.0.1 --replSet devrs
```

In a second terminal, initialize it once:

```sh
mongosh 'mongodb://127.0.0.1:27018' --eval 'rs.initiate({_id:"devrs",members:[{_id:0,host:"127.0.0.1:27018"}]})'
```

Use `mongodb://127.0.0.1:27018/smart_it_dev?replicaSet=devrs` as the development `MONGO_URI`. This is a fresh database, not a migration of existing data. Bootstrap its first admin using `docs/ACCESS_CONTROL.md`. A single-node replica set supports transactions but provides no production redundancy.

## Retesting

The regression fixture launches its own mongod on a free loopback port, initializes a disposable replica set, then stops it and removes its temporary directory. It never reads the real application's `.env` or reconfigures the running MongoDB instance.

After refreshing the isolated source copy and building its frontend:

```sh
QA_APP_ROOT=/tmp/smart-it-qa-app QA_BROWSER=1 QA_PLAYWRIGHT=/tmp/smart-it-qa-tools/node_modules/playwright node --test --test-concurrency=1 tests/assetLifecycle.test.cjs tests/accessControl.test.cjs tests/assetStatus.test.js
```

`mongod` must be on PATH, or set `QA_MONGOD` to its executable path. Omitting `QA_BROWSER=1` skips browser checks. See `tests/qa/README.md` for isolated dependency installation. The old stubbed controller tests have been replaced by direct policy tests plus real controller/transaction tests, covering the original maintenance-completion regression and stronger concurrency/rollback invariants.
