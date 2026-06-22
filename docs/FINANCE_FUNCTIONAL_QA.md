# Finance Functional QA

## Purpose
This phase verifies that the finance pages are not only opening, but the main finance APIs can create, update, and delete safe test records.

## Commands

Run the server first:

```powershell
docker start erp-postgres-1
npm run dev
```

Then in a second PowerShell:

```powershell
cd "C:\Users\hp\Desktop\أخر نسخه\MOHAMED SHAWKI ERP V85.12\apps\erp"
$env:ERP_TEST_EMAIL="admin@logistics-erp.com"
$env:ERP_TEST_PASSWORD="Admin@123456"
node scripts/smoke-finance-crud.cjs
```

## Expected Result

```text
✅ Login OK
✅ POST /api/invoices
✅ PATCH /api/invoices/...
✅ DELETE /api/invoices/...
...
CRUD result: OK | failed=0
```

## Notes
- Some modules are skipped automatically if they need a missing reference, such as no drivers or no vehicles.
- The script deletes its own test records after creating them.
- Do not run this against production data unless you are comfortable with temporary create/update/delete test records.
