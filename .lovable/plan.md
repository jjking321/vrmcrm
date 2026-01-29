

# Add Tag Search/Select to Bulk Actions Bar

## Problem

Currently, when adding a tag via bulk actions, users must type the tag name manually. This can lead to typos and duplicate tags with slight variations (e.g., "absentee" vs "Absentee").

## Solution

Replace the plain text input with a searchable dropdown that shows existing tags from the database. Users can either select an existing tag or type a new one.

## Implementation

### User Experience

1. User clicks "Add Tag" button
2. A searchable input appears showing filtered existing tags as they type
3. User can click an existing tag to select it, OR
4. Type a new tag name and press Enter to create it
5. Selected/created tag is applied to all selected properties

### Technical Approach

Use the `Command` component (cmdk-based) combined with `Popover` for a searchable combobox pattern, similar to the shadcn/ui Combobox example.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/crm/BulkActionsBar.tsx` | Add useUniqueTags hook, replace text input with searchable combobox |

## Detailed Changes

### BulkActionsBar.tsx

1. **Add imports:**
   - `useUniqueTags` hook
   - Command components (Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem)
   - Popover components
   - Check icon for selected state

2. **Add state for popover:**
   - `tagPopoverOpen` to control the dropdown visibility

3. **Replace tag input form with combobox:**
   - Show a Popover with Command-based searchable list
   - Filter existing tags as user types
   - Show "Create new tag" option when input doesn't match existing tags
   - Apply tag on selection

### UI Layout

```text
┌──────────────────────────────────────┐
│ 🔍 Search tags...                    │
├──────────────────────────────────────┤
│   absentee                           │
│   cb permit                          │
│   vacation rental                    │
├──────────────────────────────────────┤
│ + Create "new-tag-name"              │
└──────────────────────────────────────┘
```

### Selection Behavior

- Clicking an existing tag immediately adds it to selected properties
- Typing a new name and selecting "Create" option adds the new tag
- Popover closes after selection
- Toast confirms the action

