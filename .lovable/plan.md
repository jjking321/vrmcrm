
# Fix Mailing List Items Not Loading

## Problem Identified

The mailing list shows "1125 addresses" in the count (from `useMailingLists`) but displays "No addresses" because the `useMailingListItems` hook is hitting Supabase's default 1000-row limit in multiple places:

1. **Fetching items**: Only returns first 1000 of 1125 items
2. **Fetching properties**: Uses `.in(propertyIds)` which can fail with large arrays
3. **Fetching owners**: Same issue with `.in(propertyIds)`

## Solution

Implement batch fetching to bypass the 1000-row limit, following the existing pattern used elsewhere in the codebase (per the architecture memory about `supabase-data-retrieval-patterns`).

## Technical Changes

### Update `useMailingListItems` in `src/hooks/useMailingLists.ts`

Add batch fetching logic for all three queries:

```typescript
// Helper to fetch in batches of 1000
async function fetchAllInBatches<T>(
  query: () => Promise<{ data: T[] | null; error: any }>,
  batchSize = 1000
): Promise<T[]> {
  const allData: T[] = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    // Modify query with range
    const { data, error } = await query();
    if (error) throw error;
    if (!data || data.length < batchSize) hasMore = false;
    allData.push(...(data || []));
    offset += batchSize;
  }
  
  return allData;
}
```

For the items query, use range-based pagination:
```typescript
// Fetch all items in batches
let allItems: any[] = [];
let offset = 0;
const batchSize = 1000;
let hasMore = true;

while (hasMore) {
  const { data: batch, error } = await supabase
    .from('mailing_list_items')
    .select('*')
    .eq('mailing_list_id', listId)
    .order('sort_order', { ascending: true })
    .range(offset, offset + batchSize - 1);
  
  if (error) throw error;
  allItems.push(...(batch || []));
  hasMore = (batch?.length || 0) === batchSize;
  offset += batchSize;
}
```

For properties and owners, batch the `.in()` calls:
```typescript
// Batch fetch properties (in chunks of 100 for .in() operator)
const chunkSize = 100;
const propertyChunks = [];
for (let i = 0; i < propertyIds.length; i += chunkSize) {
  propertyChunks.push(propertyIds.slice(i, i + chunkSize));
}

const allProperties: any[] = [];
for (const chunk of propertyChunks) {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .in('id', chunk);
  if (error) throw error;
  allProperties.push(...(data || []));
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useMailingLists.ts` | Update `useMailingListItems` to use batch fetching for items, properties, and owners |

## Expected Result

After this fix:
- All 1125 mailing list items will load correctly
- The table will display all addresses with their contact names and mailing information
- Export CSV will include all addresses
