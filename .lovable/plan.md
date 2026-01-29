

# Fix Tag Dropdown Not Showing All Tags

## Problem Identified

The `useUniqueTags` hook fetches ALL 1,491 properties just to extract their tags. This approach has two issues:

1. **Performance**: Downloading 1,491 rows over the network just to extract a few unique tags
2. **Data truncation**: Large responses can get truncated, causing some tags to be missed

The "world traveler x" tag exists in the database but isn't appearing because it's on one of the properties that gets cut off due to response size limits.

## Solution

Create a database function that efficiently extracts unique tags using PostgreSQL's `unnest` and `DISTINCT` operations, then call it from the frontend via Supabase RPC.

## Technical Changes

### 1. Create Database Function

Create a new PostgreSQL function `get_unique_tags(p_company_id uuid)` that:
- Uses `unnest(tags)` to expand all tag arrays
- Filters out `list-` prefixed tags
- Returns distinct, sorted tags

```sql
CREATE OR REPLACE FUNCTION get_unique_tags(p_company_id uuid)
RETURNS TABLE(tag text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT t.tag 
  FROM (
    SELECT unnest(p.tags) as tag
    FROM properties p
    WHERE p.company_id = p_company_id
    AND p.tags IS NOT NULL
  ) AS t
  WHERE t.tag NOT LIKE 'list-%'
  ORDER BY t.tag;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Update useUniqueTags Hook

Replace the current approach with an RPC call:

```typescript
const { data, error } = await supabase
  .rpc('get_unique_tags', { p_company_id: companyId });

if (error) throw error;

return data?.map(row => row.tag) || [];
```

## Files to Modify

| File | Change |
|------|--------|
| Database migration | Create `get_unique_tags` function |
| `src/hooks/useUniqueTags.ts` | Use RPC call instead of fetching all properties |

## Expected Outcome

- All unique tags (including "world traveler x") will appear in the dropdown
- Much faster query execution (single SQL query vs fetching 1,491 rows)
- No response truncation issues

