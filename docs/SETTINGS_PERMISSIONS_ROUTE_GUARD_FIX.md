# Settings & Permissions Enforcement Fix

This patch adds a route-level guard in `src/proxy.ts` and tightens the permission matrix in `src/lib/permissions.ts`.

Expected effect:
- Admin and Operation Manager keep full access.
- Accountant can access finance pages only.
- HR can access HR pages only.
- Supervisor can access supervisor operational pages only.
- Viewer can only access the home page and read-only allowed pages.
- Forbidden pages return HTTP 403 instead of rendering the page.
- API requests receive the authenticated role from the signed session cookie, not only the visible role cookie.
