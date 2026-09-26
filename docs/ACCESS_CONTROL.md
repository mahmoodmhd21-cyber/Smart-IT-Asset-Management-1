# Access Control

## Permissions

- Login is public. Account registration is Admin-only, including creation of IT Staff.
- Account directory, access revocation and employee management are Admin-only.
- Asset, allocation, maintenance, license and QR operations require Admin or IT Staff.
- `/api/employees/assignees` returns active company employees' IDs, names and employee codes to Admin and IT Staff for new allocations. The older `/api/auth/assignees` endpoint remains protected for compatibility but is no longer used by the allocation UI.
- QR images, resolution and scanning are private. A printed QR token does not grant access.

All authorization uses the current database account, not the role stored in a JWT or browser storage. Password hashes are excluded from normal user queries and allocation responses.

## Deployment and First Administrator

Set `JWT_SECRET` to a securely generated, random value of at least 32 characters. The API now refuses to start with a missing/short secret. Generate a value with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and store it outside version control. Previously issued tokens must be replaced by logging in again.

Existing administrators remain usable. **Do not run bootstrap against an existing user database.** For an empty database only, set `MONGO_URI`, `JWT_SECRET`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` in a secure local environment, then run `node scripts/bootstrap-admin.js`. The password must have at least 12 characters. Remove bootstrap credentials afterward. Do not pass passwords as command-line arguments or commit them.

## Revoking Access

An administrator can send `PATCH /api/auth/users/:id/access` with their bearer token:

```json
{ "isActive": false }
```

This disables login and rejects all existing sessions on subsequent requests. `{ "isActive": true }` re-enables login without restoring old tokens. `{ "revokeSessions": true }` invalidates sessions but permits a fresh login. Every access change atomically increments the account token version. Already executing requests are not cancelled. Administrators cannot change their own access through this endpoint. Account records are retained for allocation history. The Users directory provides Disable/Enable and Revoke sessions buttons with confirmation.

Existing users without the new fields default to active with token version zero when loaded by Mongoose. No bulk database migration is needed. Legacy tokens without a version are rejected.

## Account Editing and Browser Sessions

`PATCH /api/auth/users/:id` accepts only `fullName`, `email`, and `role` (Admin or IT Staff). Only an Admin may edit another account. Self edits are rejected to prevent accidental self-demotion; use another administrator. Names/emails are trimmed, emails normalized, duplicates rejected, and each successful edit atomically revokes existing sessions. Password changes are not included in this endpoint. Accounts are deactivated, not hard-deleted, to preserve historical references.

The Users page has a prefilled editor. Employee edits/deletes are in the admin-only Personnel Directory. Existing allocation history prevents employee deletion, and active allocations prevent deactivation. Failed saves keep entered values and show the server error.

A private API 401 clears the browser session and returns to sign-in; successful login returns to the intended local route. This includes authenticated QR-image requests. A delayed 401 for an older token does not clear a newer login. A 403 or network/500 error does not log the user out. Logout propagates between tabs through storage events. Server rejection still takes effect on the next request, not as a push notification to idle clients. Browser permission guards supplement, never replace, server authorization.
