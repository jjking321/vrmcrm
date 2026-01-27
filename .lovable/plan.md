

# Migrate Legacy Email Column to Emails Array

## Problem

The previous backfill only updated owners who already had data in the `emails` JSONB array. However, **1,341 owners** have email addresses stored in the legacy single `email` column that were never migrated to the new array format.

## Current State

| Data Location | Count |
|---------------|-------|
| Legacy `email` column (not migrated) | 1,341 owners |
| `emails` JSONB array (already backfilled) | 191 owners |
| **Total owners with any email** | ~1,532 owners |

## Implementation

Create a database migration to convert legacy email column data into the new `emails` JSONB array format with full source tracking.

### Migration Logic

```sql
-- For each owner with legacy email but empty emails array:
-- 1. Get the first tag from the associated property
-- 2. Create a new emails array with one entry containing:
--    - address: the legacy email value
--    - source: first property tag
--    - addedAt: owner's created_at timestamp
--    - status: 'unknown'
--    - type: 'unknown'
--    - optedOut: false
```

### Sample Transformation

**Before:**
```
email: "jjking@mail.com"
emails: []
```

**After:**
```
email: "jjking@mail.com"  (preserved for backwards compatibility)
emails: [{
  "address": "jjking@mail.com",
  "source": "absentee",
  "addedAt": "2025-12-10T16:37:52.961Z",
  "status": "unknown",
  "type": "unknown",
  "optedOut": false
}]
```

## Files to Modify

| File | Change |
|------|--------|
| New migration file | SQL to migrate legacy email to emails array with source |

## Verification

After migration:
1. Query should show ~1,532 owners with emails in array
2. Owner Detail page displays source badges for all emails
3. Legacy email column preserved (no data loss)

## Risk Assessment

- **Low risk**: Only adds to emails array, doesn't modify legacy column
- **Non-destructive**: Legacy email preserved as backup
- **Idempotent**: Only affects owners with empty emails array

