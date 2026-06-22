# Projects & Services Closeout Audit

Scope:

- `/projects`
- `/projects/[projectId]/dashboard`
- `/projects/[projectId]/accounts`
- `/projects/[projectId]/drivers`
- `/projects/[projectId]/imports`
- `/projects/[projectId]/invoices`
- `/projects/[projectId]/payroll`
- `/projects/[projectId]/reports`
- `/projects/[projectId]/settings`
- `/cities`
- `/settings/application-account-review`

Run:

```powershell
node scripts/check-projects-services-system.cjs

$env:ERP_TEST_EMAIL="admin@logistics-erp.com"
$env:ERP_TEST_PASSWORD="Admin@123456"
node scripts/smoke-projects-services-auth-routes.cjs
```

Pass criteria:

- No required page failures.
- Main routes return 200/3xx after authenticated login.
- Sidebar/navigation maps projects, account linking review, and cities.
- Permission resources include projects, application accounts, and cities.
- Core controls exist for filters, apply/reset, and project/city workspaces.
