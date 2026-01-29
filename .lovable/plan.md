

# Fix Property Selection Not Clearing on Search or Navigation

## Problem Identified

When performing a search or navigating away from the properties view, the selected property checkboxes remain checked. This is confusing because:

1. **Search changes the displayed results** - The selection may include properties that are no longer visible
2. **Navigation leaves stale state** - Coming back to properties view shows old selections that no longer make sense

## Root Cause

In `MainApp.tsx`, the `selectedIds` state (line 273) is never cleared when:
- The search term changes
- The user navigates to a different view (owners, dashboard, settings, etc.)

The `handleViewChange` function (lines 255-265) clears filters and search term but doesn't clear `selectedIds`.

## Solution

Add logic to clear `selectedIds` in two places:

1. **When search term changes** - Clear selection when `debouncedSearchTerm` changes
2. **When view changes** - Clear selection in `handleViewChange`

## Technical Changes

### 1. Clear Selection on View Change

Add `setSelectedIds(new Set())` to the `handleViewChange` function:

```tsx
const handleViewChange = (newView: ViewMode, options?: { preserveFilters?: boolean }) => {
  if (newView === 'properties' && !options?.preserveFilters) {
    setFilterRules([]);
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setDeduplicateByOwner(false);
  }
  setViewInternal(newView);
  setSelectedPropertyId(null);
  setSelectedOwnerName(null);
  setSelectedIds(new Set()); // ADD THIS LINE
};
```

### 2. Clear Selection When Search Changes

Add a `useEffect` that clears selection when the debounced search term changes:

```tsx
// Clear selection when search term changes
useEffect(() => {
  setSelectedIds(new Set());
}, [debouncedSearchTerm]);
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/crm/MainApp.tsx` | Add selection clearing logic |

## Expected Behavior After Fix

| Action | Before Fix | After Fix |
|--------|-----------|-----------|
| Perform a search | Checkboxes stay selected | Selection cleared |
| Navigate to Owners | Checkboxes stay selected | Selection cleared |
| Navigate to Dashboard | Checkboxes stay selected | Selection cleared |
| Navigate back to Properties | Old selection visible | Fresh start, no selection |

