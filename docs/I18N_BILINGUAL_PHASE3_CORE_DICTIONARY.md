# I18N Bilingual Phase 3 - Core Dictionary Expansion

This phase expands the runtime translation dictionary for the most common ERP terms found after Phase 2.

It focuses on visible UI labels across HR, drivers, finance, projects, vehicles, reports, documents, imports, and permissions.

It also adds `scripts/scan-i18n-ui.cjs`, a cleaner scan that ignores the i18n dictionary and API route messages so UI progress can be tracked more accurately.

Run:

```powershell
node scripts/install-i18n-phase3.cjs
node scripts/check-i18n-phase3.cjs
node scripts/scan-i18n-ui.cjs
```
