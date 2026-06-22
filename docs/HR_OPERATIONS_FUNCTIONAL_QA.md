# HR / Operations Functional QA

## Scope
This QA covers the HR and operations area:
- Drivers
- Supervisors
- Attendance
- Shifts
- Supervisor tasks
- Interviews
- Rider housing
- Rider documents
- Housing / documents / warnings compatibility pages

## Automated checks
Run these commands from the ERP app root while the dev server is running:

```powershell
node scripts/check-hr-operations-system.cjs
node scripts/smoke-hr-auth-routes.cjs
node scripts/smoke-hr-functional-crud.cjs
node scripts/check-hr-operations-closeout.cjs
```

## Expected result
- Route smoke test should return `OK | failed=0`.
- Functional CRUD smoke test should return `OK | failed=0`.
- Final closeout check should return `OK | failed=0`.

## Manual spot checks
- Drivers: search, filters, export, print, add/manual import entry point.
- Supervisors: filters, export, print, details.
- Attendance: check-in/check-out flow and export.
- Supervisor tasks: create, update, cancel/delete.
- Shifts and interviews: page loads and visible controls.
