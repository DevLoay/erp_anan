# Projects & Services Functional QA

This phase validates the projects/services section beyond page rendering.

## Scope

- `/projects`
- `/cities`
- `/settings/application-account-review`
- Project workspace pages:
  - dashboard
  - accounts
  - drivers
  - imports
  - invoices
  - payroll
  - reports
  - settings

## Script

```powershell
$env:ERP_TEST_EMAIL="admin@logistics-erp.com"
$env:ERP_TEST_PASSWORD="Admin@123456"
node scripts/smoke-projects-services-functional-crud.cjs
```

## Expected result

```text
Projects/services functional CRUD result: OK | failed=0
```

## What it checks

- Creates a temporary City.
- Creates a temporary Application.
- Creates a temporary legacy Project.
- Creates a temporary ApplicationProject.
- Creates a temporary ApplicationAccount that needs account-linking review.
- Updates city/project/account review state.
- Opens project/service pages while authenticated.
- Cleans up all temporary data.
