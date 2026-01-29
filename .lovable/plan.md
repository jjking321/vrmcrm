

# Default to Newest Record as Primary in Duplicate Merge

## Current Behavior

The duplicate merge modal currently defaults to selecting the **oldest** record as the primary (the one that survives). The user wants the opposite: default to the **newest** record as primary while still stacking all contact information from older records.

## Requested Change

| Setting | Current | New |
|---------|---------|-----|
| Default primary record | Oldest created | Newest created |
| Contact stacking | All records combined | All records combined (unchanged) |
| Field values | User selects per field | User selects per field (unchanged) |

## Why This Makes Sense

- Newer records often have more up-to-date information (addresses, phones, etc.)
- Stacking ensures no contacts are lost from older records
- User still has full control to override and pick values from any record

## Technical Changes

### 1. DuplicateMergeModal.tsx

Update the `useEffect` that initializes state when a group changes:

**Current (line 211-215):**
```tsx
// Default to oldest record
const oldest = [...group.properties].sort(
  (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
)[0];
setPrimaryId(oldest.id);
```

**New:**
```tsx
// Default to newest record
const newest = [...group.properties].sort(
  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
)[0];
setPrimaryId(newest.id);
```

Also update the conflicting field default selection to use the newest record instead of oldest (line 241-242).

### 2. DuplicateWizard.tsx (if applicable)

Check if the wizard component has similar default logic and update it to match.

## What Stays the Same

- All contacts (phones, emails, owner contacts) still stack from all records
- Tags still combine from all records
- Activities from deleted records still transfer to kept record
- User can still manually select any record as primary
- User can still choose which record's value to use for each field

## User Experience After Change

1. User opens duplicate merge modal
2. **Newest** record is pre-selected as primary
3. For conflicting fields, newest record's value is pre-selected
4. Contact stacking mode defaults to "Combine all contacts" (unchanged)
5. User can still override any of these selections

## Files to Modify

| File | Change |
|------|--------|
| `src/components/crm/DuplicateMergeModal.tsx` | Default to newest record as primary and for conflicting fields |

