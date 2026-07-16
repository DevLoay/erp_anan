# Rider Documents Project Schema Fix

Fixes `/rider-documents` crash caused by selecting non-existing `Project.nameAr` and `Project.nameEn` fields.

The ERP `Project` model currently exposes `name` and `appName`, so the rider documents loader now selects schema-safe fields only.
