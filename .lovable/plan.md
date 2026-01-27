
# Backfill Source for Phone and Email Contacts

## Overview

Add source tracking to existing phone and email contacts that were imported before the source tracking feature was implemented. This will use the property's first tag as the source indicator.

## Current State

| Data Type | Records Missing Source | Records With Source |
|-----------|----------------------|---------------------|
| Phones    | 1,092 owners         | Already populated on new imports |
| Emails    | 42 owners            | Already populated on new imports |

### Source Distribution (for phones)
- `absentee`: 545 owners
- `cb permit`: 476 owners  
- `happy palms`: 71 owners

## Implementation Approach

Create a one-time database migration that updates the JSONB arrays to add source and addedAt fields to each phone/email object.

### SQL Migration Logic

```sql
-- For each owner with phones missing source:
-- 1. Get the first tag from the associated property
-- 2. Update each phone object in the array to add:
--    - source: first property tag
--    - addedAt: owner's created_at timestamp
--    - status: 'unknown' (if not set)
--    - callCount: 0 (if not set)
```

### Technical Details

The migration will:

1. **Join owners to properties** to get the tag information
2. **Use jsonb_agg with jsonb_set** to add missing fields to each contact object
3. **Set source** to the first property tag (e.g., "absentee", "cb permit", "happy palms")
4. **Set addedAt** to the owner's original `created_at` timestamp
5. **Preserve existing fields** (number, type, doNotCall, etc.)

### Sample Before/After

**Before:**
```json
{
  "number": "407-484-0628",
  "type": "mobile",
  "doNotCall": true
}
```

**After:**
```json
{
  "number": "407-484-0628",
  "type": "mobile",
  "doNotCall": true,
  "source": "absentee",
  "addedAt": "2025-12-10T16:37:52.961Z",
  "status": "unknown",
  "callCount": 0
}
```

## Files to Modify

| File | Change |
|------|--------|
| New migration file | SQL to backfill phone and email source fields |

## Verification

After migration runs:
1. Query owners table to confirm source fields are populated
2. Check Owner Detail page displays source badges correctly
3. Verify no data loss (phone numbers, emails preserved)

## Risk Assessment

- **Low risk**: Migration only adds fields, doesn't modify existing data
- **Reversible**: Source fields can be removed if needed
- **Non-breaking**: Frontend already handles missing source gracefully
