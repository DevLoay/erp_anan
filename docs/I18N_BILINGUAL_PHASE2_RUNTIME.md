# i18n Bilingual Phase 2 Runtime

This phase expands the Arabic / English switcher without rewriting every page manually.

## What changed

- Expanded the central dictionary with common ERP labels, sidebar sections, driver management terms, rider document terms, finance, projects, vehicles, and settings labels.
- Improved runtime DOM translation for text nodes, placeholders, titles, aria labels, and alt text.
- Added translation for alert/confirm messages.
- Added dynamic rules such as expiry messages and bulk update messages.
- Added a phase 2 check script.

## Run

```powershell
node scripts/install-i18n-phase2.cjs
node scripts/check-i18n-phase2.cjs
node scripts/scan-i18n-arabic.cjs
```

Then restart Next.js and test the language toggle from the header.
