
# Add Search and Filters to Mailing List Page

## Overview

Add a search bar and filter module to the mailing list detail view, enabling users to quickly find specific contacts within large mailing lists.

## Current State

The mailing list detail view (`MailingListsView.tsx`) displays a table of contacts but has no search or filtering capabilities. Users must scroll through the entire list to find specific contacts.

## Solution

### 1. Add Search Bar

Add a search input that filters the mailing list items by:
- Contact Name (using the derived `getBestMailingName`)
- Mailing Address
- Mailing City  
- Mailing State
- Mailing ZIP
- Property Address

Search will be client-side with debouncing since items are already loaded in memory.

### 2. Add Simplified Filter Bar

Create a simplified version of the filter module specifically for mailing lists with these filterable fields:
- **State** - Filter by mailing state (equals, any_of)
- **City** - Filter by mailing city (equals, contains, starts_with)
- **ZIP** - Filter by mailing ZIP (equals, starts_with)
- **Contact Name** - Filter by contact name (contains, starts_with)
- **Is Canadian** - Filter Canadian addresses (is_true/is_false)

### 3. UI Layout

The mailing list detail view will include:
```text
┌──────────────────────────────────────────────────────────────┐
│ ← Back    List Name                         [Export CSV]     │
│           123 addresses · Last exported Jan 15, 2025         │
├──────────────────────────────────────────────────────────────┤
│ [🔍 Search contacts...                    ] [Filter] [X of Y]│
├──────────────────────────────────────────────────────────────┤
│ (If filters active, show filter rules section)               │
├──────────────────────────────────────────────────────────────┤
│ Contact Name | Address | City | State | ZIP | Property       │
│ ─────────────────────────────────────────────────────────────│
│ John Smith   | 123...  | ...  | TX    | ... | ...            │
└──────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/crm/MailingListFilterBar.tsx` | Simplified filter bar for mailing lists |
| `src/hooks/useMailingListFiltering.ts` | Hook for filtering/searching mailing list items |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/crm/MailingListsView.tsx` | Add search input, filter bar, integrate filtering logic |

### useMailingListFiltering Hook

```typescript
// Handles search and filter logic for mailing list items
export function useMailingListFiltering(items: MailingListItem[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [matchType, setMatchType] = useState<'and' | 'or'>('and');
  
  // Derived mailing fields are computed for each item
  // Search matches against: contactName, mailingAddress, mailingCity, 
  //                         mailingState, mailingZip, propertyAddress
  
  // Filter rules evaluate against: state, city, zip, contactName, isCanadian
  
  const filteredItems = useMemo(() => {
    // 1. Apply search filter
    // 2. Apply filter rules
    return filtered;
  }, [items, searchTerm, filterRules, matchType]);
  
  return {
    searchTerm, setSearchTerm,
    filterRules, setFilterRules,
    matchType, setMatchType,
    filteredItems,
    totalCount: items.length,
    filteredCount: filteredItems.length,
  };
}
```

### MailingListFilterBar Component

A simplified filter bar with:
- Search input with debouncing
- Filter button with rule count badge
- Result count display
- Filter rules section (expandable)
- AND/OR toggle
- Clear all button

Available filter fields:
```typescript
const MAILING_FILTER_FIELDS = [
  { id: 'state', label: 'State', type: 'text' },
  { id: 'city', label: 'City', type: 'text' },
  { id: 'zip', label: 'ZIP', type: 'text' },
  { id: 'contactName', label: 'Contact Name', type: 'text' },
  { id: 'isCanadian', label: 'Is Canadian', type: 'checkbox' },
];
```

### Export Integration

When exporting to CSV:
- If filters are active, export only the filtered items
- Show count in export button: "Export CSV (X)"

## Edge Cases

1. **Empty search/filter results** - Show "No matches found" message with option to clear filters
2. **Large lists** - Client-side filtering is performant for lists up to 10k items
3. **Filter persistence** - Filters reset when navigating away (unlike Properties which uses sessionStorage)
