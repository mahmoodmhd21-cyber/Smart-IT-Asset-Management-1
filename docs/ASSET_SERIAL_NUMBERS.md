# Asset Serial Numbers

- `serialNumber` is optional text, trimmed, limited to 120 characters. Missing, null or blank input clears the value. Existing records without serial numbers remain valid; the table displays "Not recorded".
- Non-empty values are globally unique, ignoring case. The original letter casing is retained for display. A database unique index enforces this even for simultaneous requests. This is the default policy selected for Step 5; verify that global uniqueness matches the inventory's manufacturer conventions before deployment.
- Add, edit, list, and search support the field. API create/update responses and asset retrieval retain it. Duplicate values return 409, invalid values return 400.
- Asset creation and serial edits ensure the serial index exists before writing. If index creation fails, the request fails with 503 rather than silently permitting duplicate serials. No existing duplicates are automatically deleted or rewritten.

## Existing Databases

Back up the target database before deployment. The previous application did not persist serial numbers, so ordinary legacy records need no data migration. If serial numbers were manually inserted or imported, review non-empty values for case-insensitive duplicates and decide how to correct them before building the index. Do not drop other indexes to resolve this conflict.

The Mongoose declaration is in `models/Asset.js`. Only disposable databases were used to test serial-number writes and index creation; Step 5 does not claim to have migrated or verified an existing production database.
