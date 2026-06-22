# Settings & Permissions Closeout Audit

This phase audits and smoke-tests the ERP settings and permissions area:

- `/settings`
- `/users`
- `/user-management`
- `/permissions`
- `/audit-log`
- `/settings/payroll`
- `/settings/templates`
- `/settings/application-account-review`

## Scripts

```powershell
node scripts/check-settings-permissions-system.cjs
node scripts/smoke-settings-auth-routes.cjs
node scripts/smoke-user-management-crud.cjs
```

## Expected result

- Static audit: `Result: OK`
- Authenticated route smoke: `Authenticated settings smoke result: OK | failed=0`
- User CRUD smoke: `User management CRUD result: OK | failed=0`

## Notes

The CRUD test creates a temporary QA user, updates it, resets its password, then deactivates it through the existing API.
