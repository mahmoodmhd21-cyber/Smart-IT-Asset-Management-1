# Maintenance, Licenses and Employee Allocations

## Maintenance

Supported types are Preventive, Corrective, Repair, Upgrade, Inspection, Replacement and Cleaning. Existing types are retained rather than renamed. Statuses are Scheduled, In Progress, Completed and Cancelled.

Cancelled, like Completed, closes work and triggers the shared asset-status policy. It does not release a device with another open job or erase an active assignment; retirement remains sticky. Reopening a cancelled job reserves the asset again. Description and maintenance date are required. Nonnegative finite decimal costs are accepted, and the form supports cents.

## Licenses

The form, API and schema use `assignedSeats`; `seatsUsed` is rejected with 400 instead of silently discarded. Existing `assignedSeats` values remain unchanged.

- Stored fields: softwareName, vendor, licenseKey, licenseType, numberOfSeats, assignedSeats, purchaseDate, expiryDate, cost, status and notes.
- Types: Perpetual, Subscription, Trial and Open Source. Missing historical types remain null and display as Not recorded.
- Statuses: Active, Expired, Expiring Soon and Suspended. These are explicit saved selections, not an automatically calculated expiry forecast.
- License key is required and unique. Seats are nonnegative whole numbers, with assignedSeats no greater than numberOfSeats. Both creation and merged-document updates validate this limit. Concurrent edits use transactions so independently changing capacity and usage cannot bypass it.
- Cost is nullable for unknown historical purchases, or a finite nonnegative number. The form accepts decimal amounts. Missing historical costs are not invented as zero.
- Previously discarded fields cannot be recovered from data that was never stored; this fix prevents further loss.

## Employees and References

New allocations require `{ assetId, employeeId, allocationDate?, remarks? }`. Here `employeeId` is the Employee document's MongoDB `_id`, not the human-readable employee code. New `userId` assignments are rejected with 400. Employees do not need login accounts.

`GET /api/employees/assignees` is available to authenticated Admin and IT Staff and returns only active employees' `_id`, `fullName` and `employeeId` code. Full employee management remains admin-only. The old `/api/auth/assignees` endpoint remains a protected compatibility endpoint, but the allocation UI no longer uses it.

Employee deletion is blocked when allocation history references it. An employee with an active assignment cannot be deactivated until it is returned. Transactional employee writes prevent allocation creation from racing with deletion/deactivation. Referenced assets cannot be deleted, and maintenance cannot reference a missing asset. QR generation and lazy backfill now share the asset transaction lock, preventing dangling QR references after concurrent deletion.

## Historical Allocation Migration

Historical `Allocation.user` references are retained. The UI displays the employee when mapped, otherwise the original login-account identity with a Legacy account assignment label. Unmapped assignments can still be returned or deleted; they are not silently reassigned.

The migration defaults to a read-only preview:

```sh
node scripts/migrate-allocation-employees.js
```

Only a unique normalized email match is proposed automatically. Names are never used to guess ownership. For explicit decisions, provide a JSON object mapping allocation MongoDB IDs to employee MongoDB IDs:

```json
{
  "ALLOCATION_OBJECT_ID": "EMPLOYEE_OBJECT_ID"
}
```

Preview explicit mappings with `node scripts/migrate-allocation-employees.js --map /path/to/mappings.json`. After reviewing the preview and taking a current backup, add `--apply` to apply it. Each mapping is transactional and preserves the original `user` field for provenance. Repeating the migration does not remap completed entries. Missing/ambiguous matches remain untouched; an active historical assignment cannot be mapped to an inactive employee.

The September 26 dry run found three legacy assignments with no unique employee email match. No production/development business records were migrated. Those three identities still need an explicit owner decision; the new employee-allocation workflow does not depend on guessing them.

## Verification

`tests/moduleContracts.test.cjs` uses a disposable replica set and real HTTP controllers. It covers all maintenance types and license statuses, complete license field round-trips, partial/concurrent seat validation, migration dry-run/idempotency, employee and QR deletion races, and Chrome workflows for registration/allocation, license save/reload/edit and maintenance cancellation.

Run with the existing lifecycle/security suites using the isolated setup in `tests/qa/README.md`:

```sh
QA_APP_ROOT=/tmp/smart-it-qa-app QA_BROWSER=1 QA_PLAYWRIGHT=/tmp/smart-it-qa-tools/node_modules/playwright node --test --test-concurrency=1 tests/moduleContracts.test.cjs tests/assetLifecycle.test.cjs tests/accessControl.test.cjs tests/assetStatus.test.js
```
