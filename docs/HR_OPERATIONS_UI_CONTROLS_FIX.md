# HR / Operations UI Controls Fix

This phase tightens the HR / Operations closeout checks by:

- Adding a `downloadCsv` alias to the drivers client while preserving the existing export behavior.
- Updating the supervisors export button label to clearly mention CSV.
- Updating the supervisors row action label to include تفاصيل / خصائص.
- Adding safe redirect aliases for legacy routes:
  - `/housing` → `/rider-housing`
  - `/documents` → `/rider-documents`
  - `/warnings` → `/operations-alerts`

Expected result after running the fix:

- `node scripts/check-hr-operations-system.cjs` should keep `failures=0` and reduce UI/navigation warnings.
- The remaining optional API warnings for supervisors/shifts can be handled in the functional CRUD phase if needed.
