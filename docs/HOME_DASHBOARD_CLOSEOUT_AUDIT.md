# Home / Dashboard Closeout Audit

This phase audits the ERP home/dashboard area before UI/UX closeout.

Covered routes:

- `/`
- `/dashboard`
- `/reports`
- `/notifications`
- `/management-reports`
- `/daily-reports`
- `/operations-alerts`
- `/uploaded-reports`
- `/report-templates`

Run:

```powershell
node scripts/check-home-dashboard-system.cjs

$env:ERP_TEST_EMAIL="admin@logistics-erp.com"
$env:ERP_TEST_PASSWORD="Admin@123456"
node scripts/smoke-home-auth-routes.cjs
```

Expected result:

- All required files exist.
- All authenticated routes return `200`.
- Warnings are review items, not immediate blockers unless they hide broken navigation or permission rules.
