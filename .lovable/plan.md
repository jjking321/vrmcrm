

# Fix Stage Filter Not Matching Properties

## Problem

When filtering properties by pipeline stage (e.g., "Negotiating"), the server-side filter uses `ilike` (case-insensitive text pattern match) to compare the `stage_id` column. However, `stage_id` is a UUID column, and `ilike` does not work on UUIDs — it requires an exact `eq` match.

The same bug exists in the OR-condition path, where it generates `stage_id.ilike.<uuid>` instead of `stage_id.eq.<uuid>`.

## Fix

**File: `src/hooks/useServerFilteredProperties.ts`**

Change the `equals` case for `stage_id` to use `.eq()` instead of `.ilike()` (AND path, ~line 354), and change the OR path (~line 307) to generate `stage_id.eq.<uuid>` instead of `stage_id.ilike.<uuid>`.

Similarly, the `not_equals` case should use `.neq()` instead of `.not(field, 'ilike', value)` for `stage_id`.

Specifically:
- AND path `equals`: `query.eq('stage_id', f.value)` instead of `query.ilike(f.field, f.value)`
- AND path `not_equals`: `query.neq('stage_id', f.value)` instead of `query.not(f.field, 'ilike', f.value)`
- OR path `equals`: return `stage_id.eq.<uuid>` instead of `stage_id.ilike.<uuid>`
- OR path `not_equals`: return `stage_id.neq.<uuid>` instead of `stage_id.not.ilike.<uuid>`

No database or UI changes needed.

