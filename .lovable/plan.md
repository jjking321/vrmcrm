

# Fix Real-time Updates for Mailing List Contact Edits

## Problem

When editing a contact in the Mailing Contact Detail Modal, the database updates correctly but the mailing list table doesn't refresh to show the new data.

| What happens | Why |
|--------------|-----|
| User edits mailing address → clicks Save → success toast appears | Database is updated ✅ |
| Modal closes, table still shows old values | `mailingListItems` query cache not invalidated ❌ |

## Root Cause

```
MailingListTable
  └── handleSave() 
       └── useUpdateProperty.mutate()
            └── onSuccess: queryClient.invalidateQueries(['properties'])  ← only this
```

The `useUpdateProperty` hook only invalidates the `['properties']` query, but the mailing list table uses a **separate query** with key `['mailingListItems', listId]`. This query is never invalidated, so the UI shows stale cached data.

## Solution

Add `mailingListItems` to the list of invalidated queries in `useUpdateProperty`'s `onSuccess` callback.

## Technical Implementation

### File: `src/hooks/useProperties.ts`

Update the `onSuccess` handler in `useUpdateProperty` (around line 509):

**Before:**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['properties'] });
},
```

**After:**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['properties'] });
  queryClient.invalidateQueries({ queryKey: ['mailingListItems'] });
},
```

This ensures that when any property/owner is updated, both the properties list AND any open mailing list views will refetch fresh data.

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useProperties.ts` | Add `mailingListItems` invalidation to `useUpdateProperty` |

### Test Plan

1. Open a mailing list
2. Click on a contact row to open detail modal
3. Edit the mailing address
4. Save changes
5. Verify the table immediately shows the updated address (no page refresh needed)

