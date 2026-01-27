
# Fix Owner Detail Page Navigation

## Problem Summary

Clicking an owner from the Owners page leads to a broken page showing "Owner not found" because the `useOwnerProperties` hook fails to find matching properties.

## Root Causes

1. **Missing company_id filter**: The query to fetch owner properties doesn't filter by company, potentially causing RLS issues or empty results
2. **Case-sensitive name matching**: The owner list aggregates names case-insensitively, but the detail page uses exact string matching, causing mismatches when names have different casing in the database

## Technical Analysis

```text
useAllOwners (aggregation)        useOwnerProperties (detail fetch)
─────────────────────────────     ───────────────────────────────────
normalizedKey = name.toLowerCase()  .ilike.%${ownerName}% (fuzzy)
                                    → then exact match: primaryName === ownerName
```

Example failure scenario:
- Database has: "JOHN SMITH" and "John Smith" (two records)
- Owner list displays: "John Smith" (picks Title Case)
- Detail fetch: searches for "John Smith" but exact match fails against "JOHN SMITH"

## Implementation Plan

### File: `src/hooks/useOwnerProperties.ts`

| Change | Description |
|--------|-------------|
| Add company_id import | Import useAuth to get current company |
| Add company_id filter | Filter owners table by company_id |
| Fix name matching | Use case-insensitive comparison for name matching |
| Guard for missing company | Return empty array if no company context |

### Code Changes

**1. Add company context:**
```typescript
import { useAuth } from '@/contexts/AuthContext';

export const useOwnerProperties = (ownerName: string | null) => {
  const { company } = useAuth();
  
  return useQuery({
    queryKey: ['owner-properties', ownerName, company?.id],
    queryFn: async () => {
      if (!ownerName || !company?.id) return [];
      // ...
    },
    enabled: !!ownerName && !!company?.id,
  });
};
```

**2. Add company_id filter to query:**
```typescript
const { data: owners, error } = await supabase
  .from('owners')
  .select('property_id')
  .eq('company_id', company.id)  // Add this line
  .or(`name.ilike.%${ownerName}%`);
```

**3. Fix case-insensitive matching for final filter:**
```typescript
return properties.filter(p => {
  const ownerNameLower = ownerName.toLowerCase();
  
  // Check primary name (case-insensitive)
  const primaryName = p.owner.owners?.[0] 
    ? `${p.owner.owners[0].firstName} ${p.owner.owners[0].lastName}`.trim()
    : p.owner.name;
  if (primaryName.toLowerCase() === ownerNameLower) return true;
  
  // Check additional owners (case-insensitive)
  if (p.owner.owners) {
    return p.owner.owners.some(o => 
      `${o.firstName} ${o.lastName}`.trim().toLowerCase() === ownerNameLower
    );
  }
  
  return p.owner.name.toLowerCase() === ownerNameLower;
});
```

## Testing

After the fix:
1. Navigate to Owners page
2. Click any owner name
3. Owner detail page should load with properties and activities
4. Verify back navigation works

## Files Modified

| File | Change Type |
|------|-------------|
| `src/hooks/useOwnerProperties.ts` | Bug fix - add company filter and case-insensitive matching |
