# Arabic / English bilingual foundation

This phase adds the first safe bilingual layer for the ERP:

- Language toggle in the main header.
- Local storage key: `erp-language`.
- Automatic `html lang` and `dir` switching.
- Runtime translation for common UI labels, sidebar labels, table labels, buttons, placeholders, titles and aria labels.
- A scanner for remaining hardcoded Arabic strings.

## Commands

```powershell
node scripts/check-i18n-foundation.cjs
node scripts/scan-i18n-arabic.cjs
```

## Notes

This is foundation work. It intentionally does not rewrite every module manually in one risky change. Add missing labels to `src/lib/i18n/dictionary.ts` as modules are reviewed.

For full English layout quality, each module should gradually replace hardcoded strings with explicit dictionary keys, especially complex paragraphs, report messages, and validation errors.
