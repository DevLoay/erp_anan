# HR / Operations Navigation & Permission Fix

This phase closes the navigation and permission warnings from the HR/Operations audit.

## Covered routes

- `/drivers`
- `/supervisors`
- `/attendance`
- `/shifts`
- `/supervisor-tasks`
- `/interviews`
- `/rider-housing`
- `/rider-documents`

## What changed

- Ensures key HR/Operations pages are represented in `src/lib/modules.ts`.
- Ensures matching permission resources and route-resource mappings in `src/lib/permissions.ts`.
- Ensures report resource grouping exists for role checks if missing.
- Keeps changes idempotent so the script can safely be re-run.

## Validation

Run:

```powershell
node scripts/check-hr-operations-system.cjs
node scripts/smoke-hr-auth-routes.cjs
```
