# Home / Dashboard Navigation & Permission Fix

This patch aligns the home/dashboard/reporting section with the sidebar and permission matrix:

- Adds missing sidebar routes for `/reports`, `/daily-reports`, `/operations-alerts`, `/uploaded-reports`, and `/report-templates` when absent.
- Adds permission matrix entries for `/dashboard` and `/reports` plus reporting pages.
- Adds report resource grouping to `src/lib/permissions.ts` so reporting pages are consistently readable.

Run:

```powershell
node scripts/fix-home-dashboard-closeout.cjs
node scripts/check-home-dashboard-system.cjs
```
