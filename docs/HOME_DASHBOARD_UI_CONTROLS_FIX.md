# Home / Dashboard UI Controls Fix

This phase closes the remaining UI controls audit notes for the Home/Dashboard/Reports area.

## Changes

- Adds `dateFrom` and `dateTo` date inputs to `ReportFilterBar`.
- Normalizes the reset link label to `عرض الكل`.
- Adds a print button to the generic `ResourceWorkspace` tables used by report resource pages.

## Validation

Run:

```powershell
node scripts/check-home-ui-controls.cjs
```

Expected target:

```text
Home UI controls result: OK | failed=0
```

Warnings are acceptable only if explicitly marked optional and not required for the closeout.
