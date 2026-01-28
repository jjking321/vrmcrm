
# Allow Selection Beyond 100 Items for Bulk Actions

## Problem

Currently, the PropertyTable only receives paginated items (100 at a time), so when using "Select All" checkbox, it only selects properties visible on the current page. Users cannot select all filtered/matching properties for bulk operations.

## Solution

Add a "Select All X Properties" action that appears after using the page-level select all, allowing users to select all matching properties across all pages.

## Implementation Approach

### Pattern: Gmail-style "Select All" Enhancement

When user clicks the header checkbox to select all on current page, show a banner/notification above the table:

```
"All 100 properties on this page are selected. Select all 547 matching properties?"
```

Clicking this will select all properties from the full dataset.

## Technical Changes

### 1. Update PropertyTableWithPagination Component

Pass the full `displayProperties` array to PropertyTable so it knows the total count available for selection.

| Location | Change |
|----------|--------|
| `PropertyTableWithPagination` | Add `allProperties` prop and pass to PropertyTable |

### 2. Update PropertyTable Component

Add a new `allMatchingProperties` prop and display a selection banner when all visible items are selected but more exist.

| Location | Change |
|----------|--------|
| Props interface | Add `allMatchingProperties?: Property[]` |
| Selection logic | Add banner to select all matching properties |
| Checkbox behavior | Track "page selected" vs "all selected" states |

### 3. Add Selection Banner UI

Add a banner that appears between the header checkbox and table content:

```tsx
{allVisibleSelected && allMatchingProperties.length > properties.length && (
  <div className="px-4 py-2 bg-brand/10 text-sm flex items-center justify-between">
    <span>All {properties.length} properties on this page are selected.</span>
    <button onClick={() => onSelectAll(allMatchingProperties.map(p => p.id))}>
      Select all {allMatchingProperties.length} matching properties
    </button>
  </div>
)}
```

### 4. Update BulkActionsBar Display

Update the selection count to indicate when selection spans multiple pages:

```tsx
<span className="text-sm font-medium text-foreground">
  {selectedCount} selected
  {selectedCount > 100 && " (across pages)"}
</span>
```

## User Experience Flow

1. User applies filters → sees 547 matching properties
2. User clicks header checkbox → selects 100 on current page
3. Banner appears: "All 100 on this page selected. **Select all 547?**"
4. User clicks "Select all 547" → all matching properties selected
5. BulkActionsBar shows "547 selected (across pages)"
6. User can now perform bulk actions on all 547 properties

## Files to Modify

| File | Change |
|------|--------|
| `src/components/crm/MainApp.tsx` | Pass full displayProperties to PropertyTableWithPagination |
| `src/components/crm/PropertyTable.tsx` | Add allMatchingProperties prop and selection banner |
| `src/components/crm/BulkActionsBar.tsx` | Update count display for multi-page selections |

## Visual Design

```text
┌─────────────────────────────────────────────────────────────────┐
│ ☑ │ Address          │ Owner    │ Stage    │ Est. Revenue      │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ All 100 on this page selected. Select all 547 properties   │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ☑ │ 123 Main St      │ J. Smith │ Lead     │ $45,000           │
│ ☑ │ 456 Oak Ave      │ M. Jones │ Prospect │ $38,000           │
└─────────────────────────────────────────────────────────────────┘
```

## Alternative Considered

**Increase page size to 500+**: Rejected because it would hurt performance and doesn't scale for datasets with thousands of properties. The banner approach is more flexible and follows established UX patterns (Gmail, Google Drive).
