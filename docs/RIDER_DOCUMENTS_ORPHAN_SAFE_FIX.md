# Rider Documents Orphan-Safe Fix

Fixes `/rider-documents` crashing when old/imported `DriverDocument` rows reference a missing driver.

The data loader no longer includes the required `driver` relation directly. It loads document rows first, fetches available drivers separately, and safely attaches `driver: null` for orphaned rows.

Also keeps Project selection aligned with the current schema (`name`, `appName`, `status`) instead of non-existing `nameAr/nameEn`.
