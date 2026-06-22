# Home / Dashboard UI Controls QA

This checklist confirms the operational controls in the home, dashboard, reports, and notifications area.

## Automated checks

Run while the dev server is open in another PowerShell window:

```powershell
$env:ERP_TEST_EMAIL="admin@logistics-erp.com"
$env:ERP_TEST_PASSWORD="Admin@123456"
node scripts/check-home-ui-controls.cjs
```

Expected result:

```text
Home UI controls result: OK | failed=0
```

Warnings are acceptable when a page intentionally uses a generic resource component or has different text labels.

## Manual checks

Open these pages and test the controls:

- `/dashboard`: date filters, search, apply, reset, export, print.
- `/reports`: date filters, general report cards, embedded report tables.
- `/management-reports`: search, city/project/app/supervisor/status filters, row selection, export, print, details modal.
- `/notifications`: date filters, search, severity/city/app/source/status filters, details modal, export, print.
- `/daily-reports`: filter bar and table actions.
- `/operations-alerts`: alert filters and row details.
- `/uploaded-reports`: add/edit/delete/export if available.
- `/report-templates`: add/edit/delete/export if available.

## Browser extension warning

If `fdprocessedid` hydration warnings appear, test in Incognito or disable autofill/password-manager extensions. This is a dev-only browser mutation warning and does not indicate a broken route.
