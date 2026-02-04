

# Fix Real-Time UI Update When Deleting Mailing List Contact

## Problem

When deleting a contact from a mailing list, the row doesn't disappear immediately. The user has to wait for the query to refetch before seeing the change.

**Root cause**: The current implementation invalidates the query after deletion, which triggers a refetch. During the refetch, the old data is still displayed until the new data arrives.

## Solution

Implement **optimistic updates** using React Query's `setQueryData` to immediately remove the deleted item from the cached data before the server responds.

## Technical Implementation

### File: `src/hooks/useMailingLists.ts`

Update `useRemoveMailingListItem` to:

1. Use `onMutate` to optimistically remove the item from the cache
2. Store the previous data for rollback on error
3. Use `onError` to restore the previous data if the deletion fails
4. Keep `onSettled` to invalidate queries for consistency (ensures server state is reflected)

```typescript
export const useRemoveMailingListItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('mailing_list_items')
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
      return itemId;
    },
    onMutate: async (itemId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['mailingListItems'] });
      
      // Snapshot all mailingListItems queries
      const previousData = queryClient.getQueriesData({ queryKey: ['mailingListItems'] });
      
      // Optimistically remove from all matching queries
      queryClient.setQueriesData(
        { queryKey: ['mailingListItems'] },
        (old: any[]) => old?.filter(item => item.id !== itemId) ?? []
      );
      
      return { previousData };
    },
    onError: (err, itemId, context) => {
      // Rollback on error
      context?.previousData?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error('Failed to remove from mailing list');
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['mailingListItems'] });
      queryClient.invalidateQueries({ queryKey: ['mailingLists'] });
    },
  });
};
```

### Why This Works

| Before | After |
|--------|-------|
| Delete → Wait for refetch → UI updates | Delete → UI updates immediately → Refetch in background |
| User sees stale data for 1-2 seconds | User sees instant feedback |

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useMailingLists.ts` | Add optimistic update logic to `useRemoveMailingListItem` |

### Edge Cases Handled

1. **Network failure**: If deletion fails, the item reappears in the list with an error toast
2. **Multiple deletions**: Each deletion optimistically updates the cache independently
3. **Filter/search active**: The optimistic removal happens on the raw data, which then flows through the filtering logic

