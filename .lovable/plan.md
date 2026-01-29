

# Fix Auto-Merge "Keep Newest" - Improve Feedback and Complete Wizard Update

## Problem Analysis

Based on investigating the network requests and code, the auto-merge **IS working** - I can see successful database operations (DELETE requests returning 204). However, there are two issues causing the perception that "nothing is happening":

1. **No visual loading feedback** - The button just becomes disabled with no spinner or status text
2. **DuplicateWizard still defaults to oldest** - This component wasn't updated when DuplicateMergeModal was changed

## Changes Required

### 1. Add Loading Feedback to Auto-Merge Buttons

Update the auto-merge buttons in DataCleanupTool to show a spinner and "Merging..." text while processing.

**File:** `src/components/crm/DataCleanupTool.tsx`

| Current | New |
|---------|-----|
| `Auto-merge (Keep Oldest)` | Shows spinner + "Merging..." when `isPending` |
| `Auto-merge (Keep Newest)` | Shows spinner + "Merging..." when `isPending` |

### 2. Update DuplicateWizard to Default to Newest

Align the wizard with DuplicateMergeModal by changing the default primary record from oldest to newest.

**File:** `src/components/crm/DuplicateWizard.tsx`

Change:
```tsx
const oldest = [...currentGroup.properties].sort(
  (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
)[0];
setPrimaryId(oldest.id);
```

To:
```tsx
const newest = [...currentGroup.properties].sort(
  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
)[0];
setPrimaryId(newest.id);
```

Also update the conflicting field selection default to use `newest.id` instead of `oldest.id`.

## Summary of Files to Modify

| File | Change |
|------|--------|
| `src/components/crm/DataCleanupTool.tsx` | Add loading spinners to auto-merge buttons |
| `src/components/crm/DuplicateWizard.tsx` | Default to newest record instead of oldest |

## Result

After these changes:
- Users will see a clear loading indicator when auto-merge is running
- Both the modal and wizard will consistently default to keeping the newest record
- The success toast will still show after completion with merge statistics

