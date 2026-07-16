# Rider Documents Driver Linking Fix

This patch fixes imported rider documents that show blank delegate/city/project even though the rider exists.

## Cause
Old/imported DriverDocument rows may have a stale driverId or may not be linked to the current Driver.id. The document number usually matches Driver.nationalId/internalCode/driverCode, so the page now enriches rows manually instead of relying only on Prisma's required relation include.

## Verification
Run:

```powershell
node scripts/check-rider-documents-module.cjs
node scripts/smoke-rider-documents-crud.cjs
```

Then open /rider-documents and confirm delegate/city/project columns are populated for matched rows.
