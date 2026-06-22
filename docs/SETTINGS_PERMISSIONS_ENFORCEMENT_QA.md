# Settings & Permissions Enforcement QA

This phase validates that the permissions screens are not only visible, but that role-based access is enforced after login.

## Scripts added

- `scripts/smoke-permission-role-enforcement.cjs`
  - Creates temporary users for ACCOUNTANT, HR, SUPERVISOR, and VIEWER.
  - Logs in as each role.
  - Checks allowed and denied routes.
  - Deletes temporary users at the end.

- `scripts/check-settings-permissions-closeout.cjs`
  - Verifies required settings/permissions files exist.
  - Checks that permission resources include finance and vehicle modules.

## Run

```powershell
$env:ERP_TEST_EMAIL="admin@logistics-erp.com"
$env:ERP_TEST_PASSWORD="Admin@123456"
node scripts/smoke-permission-role-enforcement.cjs
node scripts/check-settings-permissions-closeout.cjs
```

## Expected result

```text
Permission role enforcement result: OK | failed=0
Settings permissions closeout result: OK | failed=0
```

If any route returns `200` when it should be denied, then the permission gate/proxy must be hardened before closeout.
